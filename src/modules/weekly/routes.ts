import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import { getMyReportsSchema, upsertMyReportSchema } from "./schema.js";
import { parseYmdToUtcDate, toWeekStartUtc, toYmd } from "../../common/utils.js";

const weeklyRoutes: FastifyPluginAsync = async (app) => {
  // 내 보고서 조회 (단건/리스트)
app.get(
  "/weekly/me",
  { preHandler: [requireAuth], schema: getMyReportsSchema },
  async (req: any, reply) => {
    const userId = req.user.sub as string;
    const q = req.query as {
      teamId: string;
      startDate?: string;
      endDate?: string;
    };

    const teamId = q.teamId?.trim();
    if (!teamId) return reply.status(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });

    const isMember = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    if (!isMember) return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });

    // 기본값: 오늘(UTC) 기준 과거 1개월 ~ 오늘
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const startRaw = q.startDate ? parseYmdToUtcDate(q.startDate) : addMonthsUtc(todayUtc, -1);
    const endRaw = q.endDate ? parseYmdToUtcDate(q.endDate) : todayUtc;

    // weekStart 기준으로 정규화
    const startWs = toWeekStartUtc(startRaw);
    const endWs = toWeekStartUtc(endRaw);

    const endExclusive = addDaysUtc(endWs, 7);

    const reports = await app.prisma.weeklyReport.findMany({
      where: {
        teamId,
        userId,
        weekStart: {
          gte: startWs,
          lt: endExclusive,
        },
      },
      orderBy: { weekStart: "desc" },
    });

    return reply.send({
      startDate: toYmd(startWs),
      endDate: toYmd(endWs),
      reports: reports.map((r) => ({
        ...r,
        weekStart: toYmd(r.weekStart),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  }
);

// ---- helpers ----
function addDaysUtc(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function addMonthsUtc(d: Date, months: number) {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

// POST /reports/upsert (JSON)
app.post(
  "/weekly/upsert",
  {
    preHandler: [
      requireAuth,
      requireTeamMember(app, (req: any) => (req.body?.teamId as string) ?? ""),
    ],
    schema: upsertMyReportSchema,
  },
  async (req: any, reply) => {
    const userId = req.user.sub as string;
    const body = req.body as {
      teamId: string;
      weekStart: string;
      thisWeek: string;
      nextWeek: string;
      issue?: string | null;
      solution?: string | null;
    };

    const teamId = body.teamId.trim();
    const ws = toWeekStartUtc(parseYmdToUtcDate(body.weekStart));

    const report = await app.prisma.weeklyReport.upsert({
      where: { teamId_userId_weekStart: { teamId, userId, weekStart: ws } },
      create: {
        teamId,
        userId,
        weekStart: ws,
        thisWeek: body.thisWeek ?? "",
        nextWeek: body.nextWeek ?? "",
        issue: body.issue?.trim() ? body.issue : null,
        solution: body.solution?.trim() ? body.solution : null,
      },
      update: {
        thisWeek: body.thisWeek ?? "",
        nextWeek: body.nextWeek ?? "",
        issue: body.issue?.trim() ? body.issue : null,
        solution: body.solution?.trim() ? body.solution : null,
      },
    });

    return reply.send({
      report: {
        ...report,
        weekStart: toYmd(report.weekStart),
        updatedAt: report.updatedAt.toISOString(),
      },
    });
  }
);
}

export default weeklyRoutes;
