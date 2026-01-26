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
        weekStart?: string;
        limit?: number;
        beforeWeekStart?: string;
      };

      const teamId = q.teamId?.trim();
      if (!teamId) return reply.code(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });

      const isMember = await app.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { id: true },
      });
      if (!isMember) return reply.code(403).send({ code: "FORBIDDEN", message: "forbidden" });

      if (q.weekStart) {
        const ws = toWeekStartUtc(parseYmdToUtcDate(q.weekStart));
        const report = await app.prisma.weeklyReport.findUnique({
          where: { teamId_userId_weekStart: { teamId, userId, weekStart: ws } },
        });

        return reply.send({
          mode: "one",
          report: report
            ? {
                ...report,
                weekStart: toYmd(report.weekStart),
                updatedAt: report.updatedAt.toISOString(),
              }
            : null,
          reports: [],
        });
      }

      const limit = Math.max(1, Math.min(Number(q.limit ?? 8), 52));
      const before = q.beforeWeekStart ? toWeekStartUtc(parseYmdToUtcDate(q.beforeWeekStart)) : undefined;

      const reports = await app.prisma.weeklyReport.findMany({
        where: {
          teamId,
          userId,
          ...(before ? { weekStart: { lt: before } } : {}),
        },
        orderBy: { weekStart: "desc" },
        take: limit,
      });

      return reply.send({
        mode: "list",
        report: null,
        reports: reports.map((r) => ({
          ...r,
          weekStart: toYmd(r.weekStart),
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    }
  );

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
