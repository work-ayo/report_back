import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import { getMyReportsIndexSchema, getMyReportOneSchema, upsertMyReportSchema } from "./schema.js";
import { parseYmdToUtcDate, toWeekStartUtc, toYmd } from "../../common/utils.js";

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

const weeklyRoutes: FastifyPluginAsync = async (app) => {
  /**
   * 주차 인덱스(있/없만)
   */
app.get(
  "/weekly/me/index",
  { preHandler: [requireAuth], schema: getMyReportsIndexSchema },
  async (req: any, reply) => {
    const userId = req.user.sub as string;
    const q = req.query as { teamId: string; startDate?: string; endDate?: string };

    const teamId = q.teamId?.trim();
    if (!teamId) return reply.status(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });

    const isMember = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    if (!isMember) return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const startRaw = q.startDate ? parseYmdToUtcDate(q.startDate) : addMonthsUtc(todayUtc, -1);
    const endRaw = q.endDate ? parseYmdToUtcDate(q.endDate) : todayUtc;

    const startWs = toWeekStartUtc(startRaw);
    const endWs = toWeekStartUtc(endRaw);
    const endExclusive = addDaysUtc(endWs, 7);

    const rows = await app.prisma.weeklyReport.findMany({
      where: {
        teamId,
        userId,
        weekStart: { gte: startWs, lt: endExclusive },
      },
      select: { weekStart: true },
      orderBy: { weekStart: "desc" },
    });

    return reply.send({
      startDate: toYmd(startWs),
      endDate: toYmd(endWs),
      weeks: rows.map((r) => toYmd(r.weekStart)),
    });
  }
);


  /**
   *  주차 단건(선택하면 본문 내려줌)
   */
app.get(
  "/weekly/me",
  { preHandler: [requireAuth], schema: getMyReportOneSchema },
  async (req: any, reply) => {
    const userId = req.user.sub as string;
    const q = req.query as { teamId: string; weekStart: string };

    const teamId = q.teamId?.trim();
    if (!teamId) return reply.status(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });

    const wsRaw = parseYmdToUtcDate(q.weekStart);
    const ws = toWeekStartUtc(wsRaw);

    const isMember = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    if (!isMember) return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });

    const report = await app.prisma.weeklyReport.findUnique({
      where: { teamId_userId_weekStart: { teamId, userId, weekStart: ws } },
      select: {
        teamId: true,
        userId: true,
        weekStart: true,
        thisWeek: true,
        nextWeek: true,
        issue: true,
        solution: true,
        updatedAt: true,
      },
    });

    return reply.send({
      report: report
        ? {
            teamId: report.teamId,
            userId: report.userId,
            weekStart: toYmd(report.weekStart),
            thisWeek: report.thisWeek ?? "",
            nextWeek: report.nextWeek ?? "",
            issue: report.issue ?? null,
            solution: report.solution ?? null,
            updatedAt: report.updatedAt.toISOString(),
          }
        : null,
    });
  }
);


  /**
   * upsert
   */
  app.post(
    "/weekly",
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => (req.body?.teamId as string) ?? "")],
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
};

export default weeklyRoutes;
