import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../common/middleware/auth.js";
import {
  createDailyReportEntrySchema,
  deleteDailyReportEntrySchema,
  getDailyReportEntriesSchema,
  updateDailyReportEntrySchema,
} from "./schema.js";

function toDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function nextDate(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const dailyReportEntrySelect = {
  dailyReportEntryId: true,
  teamId: true,
  userId: true,
  reportDate: true,
  startTime: true,
  endTime: true,
  content: true,
  projectId: true,
  project: {
    select: {
      projectId: true,
      teamId: true,
      code: true,
      name: true,
      colorCode: true,
    },
  },
  user: {
    select: {
      userId: true,
      id: true,
      name: true,
    },
  },
};

const dailyReportRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/teams/:teamId/daily-report/entries",
    {
      preHandler: [requireAuth],
      schema: getDailyReportEntriesSchema,
    },
    async (req: any, reply) => {
      const userId = req.user.sub as string;

      const { teamId } = req.params as {
        teamId: string;
      };

      const { reportDate, scope = "me" } = req.query as {
        reportDate: string;
        scope?: "me" | "team";
      };

      const me = await app.prisma.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          globalRole: true,
        },
      });

      if (!me) {
        return reply.status(401).send({
          code: "UNAUTHORIZED",
          message: "unauthorized",
        });
      }

      const isAdmin = me.globalRole === "ADMIN";
      const viewTeamScope = isAdmin && scope === "team";

      const teamMember = await app.prisma.teamMember.findFirst({
        where: {
          teamId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!teamMember && !isAdmin) {
        return reply.status(403).send({
          code: "TEAM_FORBIDDEN",
          message: "team forbidden",
        });
      }

      const entries = await app.prisma.dailyReportEntry.findMany({
        where: {
          teamId,
          ...(viewTeamScope ? {} : { userId }),
          reportDate: {
            gte: toDateOnly(reportDate),
            lt: nextDate(reportDate),
          },
        },
        orderBy: [
          { userId: "asc" },
          { startTime: "asc" },
          { createdAt: "asc" },
        ],
        select: dailyReportEntrySelect,
      });

      return reply.send(entries);
    }
  );

  app.post(
    "/teams/:teamId/daily-report/entries",
    {
      preHandler: [requireAuth],
      schema: createDailyReportEntrySchema,
    },
    async (req: any, reply) => {
      const userId = req.user.sub as string;

      const { teamId } = req.params as {
        teamId: string;
      };

      const body = req.body as {
        reportDate: string;
        startTime: string;
        endTime: string;
        projectId?: string | null;
        content?: string | null;
      };

      const reportDate = String(body.reportDate ?? "").trim();
      const startTime = String(body.startTime ?? "").trim();
      const endTime = String(body.endTime ?? "").trim();
      const projectId = String(body.projectId ?? "").trim() || null;
      const content = String(body.content ?? "").trim();

      const teamMember = await app.prisma.teamMember.findFirst({
        where: {
          teamId,
          userId,
        },
        select: {
          id: true,
        },
      });

      const me = await app.prisma.user.findUnique({
        where: { userId },
        select: {
          globalRole: true,
        },
      });

      const isAdmin = me?.globalRole === "ADMIN";

      if (!teamMember && !isAdmin) {
        return reply.status(403).send({
          code: "TEAM_FORBIDDEN",
          message: "team forbidden",
        });
      }

      if (projectId) {
        const project = await app.prisma.project.findFirst({
          where: {
            projectId,
            teamId,
          },
          select: {
            projectId: true,
          },
        });

        if (!project) {
          return reply.status(400).send({
            code: "INVALID_PROJECT",
            message: "project is not in the same team",
          });
        }
      }

      const entry = await app.prisma.dailyReportEntry.create({
        data: {
          teamId,
          userId,
          reportDate: toDateOnly(reportDate),
          startTime,
          endTime,
          projectId,
          content: content.length > 0 ? content : null,
        },
        select: dailyReportEntrySelect,
      });

      return reply.code(201).send(entry);
    }
  );

  app.patch(
    "/daily-report/entries/:dailyReportEntryId",
    {
      preHandler: [requireAuth],
      schema: updateDailyReportEntrySchema,
    },
    async (req: any, reply) => {
      const userId = req.user.sub as string;

      const { dailyReportEntryId } = req.params as {
        dailyReportEntryId: string;
      };

      const body = req.body as {
        reportDate?: string;
        startTime?: string;
        endTime?: string;
        projectId?: string | null;
        content?: string | null;
      };

      const existing = await app.prisma.dailyReportEntry.findFirst({
        where: {
          dailyReportEntryId,
          userId,
        },
        select: {
          dailyReportEntryId: true,
          teamId: true,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "DAILY_REPORT_ENTRY_NOT_FOUND",
          message: "daily report entry not found",
        });
      }

      const data: any = {};

      if (body.reportDate !== undefined) {
        data.reportDate = toDateOnly(String(body.reportDate).trim());
      }

      if (body.startTime !== undefined) {
        data.startTime = String(body.startTime).trim();
      }

      if (body.endTime !== undefined) {
        data.endTime = String(body.endTime).trim();
      }

      if (body.projectId !== undefined) {
        const projectId = String(body.projectId ?? "").trim() || null;

        if (projectId) {
          const project = await app.prisma.project.findFirst({
            where: {
              projectId,
              teamId: existing.teamId,
            },
            select: {
              projectId: true,
            },
          });

          if (!project) {
            return reply.status(400).send({
              code: "INVALID_PROJECT",
              message: "project is not in the same team",
            });
          }
        }

        data.projectId = projectId;
      }

      if (body.content !== undefined) {
        const content = String(body.content ?? "").trim();
        data.content = content.length > 0 ? content : null;
      }

      const updated = await app.prisma.dailyReportEntry.update({
        where: {
          dailyReportEntryId,
        },
        data,
        select: dailyReportEntrySelect,
      });

      return reply.send(updated);
    }
  );

  app.delete(
    "/daily-report/entries/:dailyReportEntryId",
    {
      preHandler: [requireAuth],
      schema: deleteDailyReportEntrySchema,
    },
    async (req: any, reply) => {
      const userId = req.user.sub as string;

      const { dailyReportEntryId } = req.params as {
        dailyReportEntryId: string;
      };

      const existing = await app.prisma.dailyReportEntry.findFirst({
        where: {
          dailyReportEntryId,
          userId,
        },
        select: {
          dailyReportEntryId: true,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "DAILY_REPORT_ENTRY_NOT_FOUND",
          message: "daily report entry not found",
        });
      }

      await app.prisma.dailyReportEntry.delete({
        where: {
          dailyReportEntryId,
        },
      });

      return reply.send({
        ok: true,
      });
    }
  );
};

export default dailyReportRoutes;