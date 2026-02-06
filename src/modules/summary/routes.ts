import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import { homeSummarySchema } from "./schema.js";
import { E } from "../../common/errors.js";
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
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
  { preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)], schema: homeSummarySchema },
  async (req: any, reply) => {
    const userId = req.user.sub as string;
    const teamId = req.params.teamId as string;

   
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

    const projectSummaries = projects.map((p: any) => {
      const dueDate = p.endDate ? toYmd(p.endDate) : null;
      return {
        projectId: p.projectId,
        name: p.name,
        startDate:p.startDate,
        endDate:p.endDate,
        status: dueDate && (ddayLabelDays(dueDate) ?? 0) < 0 ? "DONE" : "ACTIVE",
        budget: { currency: "KRW", amount: Number(p.price ?? 0) },
        dueDate,
      };
    });

    // ===== KPI =====
    let activeProjects = 0;
    let dueSoonProjects = 0;
    let thisMonthAmount = 0;

    for (const p of projectSummaries) {
      if (p.status === "ACTIVE") {
        activeProjects += 1;
        thisMonthAmount += p.budget.amount;

        const days = p.dueDate ? ddayLabelDays(p.dueDate) : null;
        if (days !== null && days >= 0 && days <= 7) dueSoonProjects += 1;
      }
    }

    // ===== myTasks =====
    const now = new Date();
    const weekStart = startOfWeekMonday(now);

    const cards = await app.prisma.card.findMany({
      where: {
        createdByUserId: userId,
        board: { teamId },
      },
      select: {
        cardId: true,
        title: true,
        dueDate: true,
        updatedAt: true,
        board: { select: { boardId: true, name: true } },
        project: { select: { projectId: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    });

    const myTasks = cards.map((c: any) => ({
      cardId: c.cardId,
      title: c.title,
      boardId: c.board.boardId,
      boardName: c.board.name,
      projectId: c.project?.projectId ?? null,
      projectName: c.project?.name ?? null,
      dueDate: c.dueDate ? toYmd(c.dueDate) : undefined,
    }));

    // ===== openIssues / thisWeekDoneCards (임시 정의) =====
    // DONE 개념이 없어서:
    // - openIssues: 팀 전체 카드 수(= 오픈 이슈로 임시)
    // - thisWeekDoneCards: 이번주 생성된 카드 수(또는 이번주 업데이트 카드 수)
    const openIssues = await app.prisma.card.count({
      where: { board: { teamId } },
    });

    // 월요일 00:00 (local)
const weekEndExcl = addDays(weekStart, 7); 

const thisWeekDoneCards = await app.prisma.card.count({
  where: {
    board: { teamId },
    dueDate: {
      gte: weekStart,
      lt: weekEndExcl,
    },
  },
});
    // ===== deadlines =====
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
          projectId: t.projectId,
          projectName: t.projectName,
          boardId: t.boardId,
        });
      }
    }

    deadlines.sort((a, b) => {
      const da = ddayLabelDays(a.date) ?? 999999;
      const db = ddayLabelDays(b.date) ?? 999999;
      return da - db;
    });

    const deadlinesTop = deadlines.slice(0, 10);

    // ===== team workload =====
    const members = await app.prisma.teamMember.findMany({
      where: { teamId },
      select: { user: { select: { userId: true, name: true } } },
    });

    const ids = members.map((m: any) => m.user.userId);

    const activeCounts = await app.prisma.card.groupBy({
      by: ["createdByUserId"],
      where: { board: { teamId }, createdByUserId: { in: ids } },
      _count: { _all: true },
    });

    const weekCounts = await app.prisma.card.groupBy({
      by: ["createdByUserId"],
      where: { board: { teamId }, createdByUserId: { in: ids },  
      dueDate: {
      gte: weekStart,
      lt: weekEndExcl,
    }, },
      _count: { _all: true },
    });

    const activeMap = new Map(activeCounts.map((x: any) => [x.createdByUserId, x._count._all]));
    const weekMap = new Map(weekCounts.map((x: any) => [x.createdByUserId, x._count._all]));

    const team = members.map((m: any) => ({
      userId: m.user.userId,
      name: m.user.name,
      activeCardCount: activeMap.get(m.user.userId) ?? 0,
      doneThisWeekCount: weekMap.get(m.user.userId) ?? 0,
    }));

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
