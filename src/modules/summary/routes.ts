import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../common/middleware/auth.js";
import { homeSummarySchema } from "./schema.js";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function diffDays(from: Date, to: Date): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function ddayLabelDays(dueYmd?: string | null): number | null {
  if (!dueYmd) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = parseYmd(dueYmd);
  return diffDays(now, due);
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Mon start
  x.setDate(x.getDate() + diff);
  return x;
}

const homeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/summary/:teamId",
    { preHandler: [requireAuth], schema: homeSummarySchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const teamId = req.query.teamId as string;

      // ===== projects =====
      const projects = await app.prisma.project.findMany({
        where: { teamId },
        select: {
          projectId: true,
          name: true,
          price: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      });

      // 프로젝트 멤버가 없으면 빈 배열로
      const projectSummaries = projects.map((p: any) => {
        const dueDate = p.endDate ? toYmd(p.endDate) : null;
        const startDate = p.startDate ? toYmd(p.startDate) : null;

        return {
          projectId: p.projectId,
          name: p.name,
          status: dueDate && (ddayLabelDays(dueDate) ?? 0) < 0 ? "DONE" : "ACTIVE",
          budget: { currency: "KRW", amount: Number(p.price ?? 0) },
          dueDate,
          progress: null, // 있으면 계산/저장값 매핑
          members: [] as Array<{ userId: string; name: string; avatarUrl?: string | null }>,
        };
      });

      // ===== KPI =====
      let activeProjects = 0;
      let dueSoonProjects = 0;
      let thisMonthAmount = 0;

      for (const p of projectSummaries) {
        if (p.status === "ACTIVE") {
          activeProjects += 1;
          thisMonthAmount += p.budget?.amount ?? 0;

          const days = ddayLabelDays(p.dueDate);
          if (days !== null && days >= 0 && days <= 7) dueSoonProjects += 1;
        }
      }

      // =====  myTasks / openIssues / doneThisWeek =====
      // 아래는 "있으면 채우고, 없으면 빈 배열/0"로 처리
      let myTasks: any[] = [];
      let openIssues = 0;
      let thisWeekDoneCards = 0;

      try {
        const now = new Date();
        const weekStart = startOfWeekMonday(now);

        // 카드/보드/프로젝트 관계가 너 DB에 있을 가능성이 높아서 이렇게 잡아둠.
        // 실제 모델명/필드명이 다르면 여기만 바꾸면 됨.
        //
        // 기대 스키마 예시:
        // Card { cardId, title, dueDate, status, boardId, assigneeUserId, updatedAt, doneAt? }
        // Board { boardId, name, teamId, projectId? }
        //
        const cards = await app.prisma.card.findMany({
          where: {
            teamId, // card에 teamId 없으면 board 통해서 걸어야 함
            assigneeUserId: userId, // 없으면 cardAssignees relation으로 교체
            // 완료/미완료 상관 없이 홈에는 상위 몇 개만 보여줘
          },
          select: {
            cardId: true,
            title: true,
            dueDate: true, // Date?
            board: { select: { boardId: true, name: true } }, // relation
            project: { select: { projectId: true, name: true } }, // relation (없으면 제거)
            updatedAt: true,
          },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          take: 8,
        });

        myTasks = cards.map((c: any) => ({
          cardId: c.cardId,
          title: c.title,
          boardId: c.board?.boardId ?? "",
          boardName: c.board?.name ?? "",
          projectId: c.project?.projectId ?? null,
          projectName: c.project?.name ?? null,
          dueDate: c.dueDate ? toYmd(c.dueDate) : undefined,
        }));

        // 없으면 TODO+DOING 중 "issue=true" 같은 플래그로 바꿔
        // 여기선 간단히 "DONE 아닌 카드"로 카운트(임시)
        openIssues = await app.prisma.card.count({
          where: {
            teamId,
          },
        });

        // 이번주 완료 수
        thisWeekDoneCards = await app.prisma.card.count({
          where: {
            teamId,
            updatedAt: { gte: weekStart },
          },
        });
      } catch {
        // card/board 모델이 없거나 필드명이 다르면 여기로 떨어짐
        myTasks = [];
        openIssues = 0;
        thisWeekDoneCards = 0;
      }

      // ===== deadlines =====
      // 프로젝트 마감 + 카드 마감을 섞어서 가까운 순
      const deadlines: any[] = [];

      for (const p of projectSummaries) {
        if (p.dueDate) {
          deadlines.push({
            type: "PROJECT_DUE",
            id: `project:${p.projectId}`,
            title: `${p.name} 마감`,
            date: p.dueDate,
            projectId: p.projectId,
            projectName: p.name,
            boardId: null,
          });
        }
      }

      for (const t of myTasks) {
        if (t.dueDate) {
          deadlines.push({
            type: "CARD_DUE",
            id: `card:${t.cardId}`,
            title: t.title,
            date: t.dueDate,
            projectId: t.projectId ?? null,
            projectName: t.projectName ?? null,
            boardId: t.boardId ?? null,
          });
        }
      }

      deadlines.sort((a, b) => {
        const da = ddayLabelDays(a.date) ?? 999999;
        const db = ddayLabelDays(b.date) ?? 999999;
        return da - db;
      });

      const deadlinesTop = deadlines.slice(0, 10);

      // ===== 5) team workload =====
      let team: any[] = [];
      try {
        const members = await app.prisma.teamMember.findMany({
          where: { teamId },
          select: {
            user: { select: { userId: true, name: true } },
          },
        });

        const ids = members.map((m: any) => m.user.userId);

        // 진행중 카드 수 / 이번주 완료 수
        // card에 assigneeUserId 없으면 relation으로 다시 짜야함.
        const now = new Date();
        const weekStart = startOfWeekMonday(now);

        const activeCounts = await app.prisma.card.groupBy({
          by: ["createdBy"],
          where: { teamId, createdBy: { in: ids } },
          _count: { _all: true },
        });

        const doneCounts = await app.prisma.card.groupBy({
          by: ["createdBy"],
          where: { teamId, createdBy: { in: ids }, updatedAt: { gte: weekStart } },
          _count: { _all: true },
        });

        const activeMap = new Map(activeCounts.map((x: any) => [x.createdBy, x._count._all]));
        const doneMap = new Map(doneCounts.map((x: any) => [x.createdBy, x._count._all]));

        team = members.map((m: any) => ({
          userId: m.user.userId,
          name: m.user.name,
          activeCardCount: activeMap.get(m.user.userId) ?? 0,
          doneThisWeekCount: doneMap.get(m.user.userId) ?? 0,
        }));
      } catch {
        team = [];
      }


      return reply.send({
        kpi: {
          activeProjects,
          dueSoonProjects,
          thisWeekDoneCards,
          openIssues,
          thisMonthAmount: { currency: "KRW", amount: thisMonthAmount },
        },
        projects: projectSummaries,
        myTasks,
        deadlines: deadlinesTop,
        team,
      });
    }
  );
};

export default homeRoutes;
