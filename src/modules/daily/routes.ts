import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import { listDailyReportsSchema, upsertDailyReportSchema } from "./schema.js";

const dailyRoutes: FastifyPluginAsync = async (app) => {
  app.post("/daily", { preHandler: [requireAuth, requireTeamMember(app, (req:any) => req.body?.teamId ?? "")], schema: upsertDailyReportSchema }, async (req:any, reply) => {
    const userId = req.user.sub as string;
    const { teamId, cardId, workedAt, content } = req.body;
    const when = new Date(String(workedAt));
    if (Number.isNaN(when.getTime())) return reply.status(400).send({ code: "INVALID_WORKED_AT" });

    const report = await app.prisma.dailyReport.create({ data: { teamId, userId, cardId: cardId || null, workedAt: when, content: String(content).trim() } });
    return reply.send({ report: { ...report, workedAt: report.workedAt.toISOString() } });
  });

  app.get("/daily", { preHandler: [requireAuth], schema: listDailyReportsSchema }, async (req:any, reply) => {
    const userId = req.user.sub as string;
    const { teamId, from, to } = req.query;
    const member = await app.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { id: true } });
    if (!member) return reply.status(403).send({ code: "FORBIDDEN" });

    const workedAt: any = {};
    if (from) workedAt.gte = new Date(from);
    if (to) workedAt.lte = new Date(to);

    const rows = await app.prisma.dailyReport.findMany({
      where: { teamId, ...(Object.keys(workedAt).length ? { workedAt } : {}) },
      orderBy: { workedAt: "desc" },
      include: { user: { select: { userId: true, name: true } }, card: { select: { cardId: true, title: true, md: true, dueDate: true } } },
    });
    return reply.send({ reports: rows.map((r:any) => ({ ...r, workedAt: r.workedAt.toISOString() })) });
  });

  app.get("/teams/:teamId/gantt", { preHandler: [requireAuth, requireTeamMember(app, (req:any) => req.params.teamId)], }, async (req:any) => {
    const teamId = String(req.params.teamId);
    const cards = await app.prisma.card.findMany({ where: { board: { teamId }, dueDate: { not: null } }, select: { cardId: true, title: true, md: true, dueDate: true, assignee: { select: { userId: true, name: true } }, project: { select: { projectId: true, name: true, colorCode: true } } } });
    return { items: cards.map((c:any) => ({ ...c, startAt: new Date(c.dueDate.getTime() - c.md * 24 * 60 * 60 * 1000).toISOString(), endAt: c.dueDate.toISOString() })) };
  });
};

export default dailyRoutes;
