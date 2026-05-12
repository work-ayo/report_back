import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../../common/middleware/auth.js";
import { getAdminDailyReportOverviewSchema } from "./schema.js";

function toDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function nextDate(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(startDate: string, endDate: string) {
  const result: string[] = [];
  const cur = toDateOnly(startDate);
  const end = toDateOnly(endDate);

  while (cur <= end) {
    result.push(dateKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return result;
}

function diffMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;

  const startParts = start.split(":");
  const endParts = end.split(":");

  if (startParts.length !== 2 || endParts.length !== 2) return 0;

  const sh = Number(startParts[0]);
  const sm = Number(startParts[1]);
  const eh = Number(endParts[0]);
  const em = Number(endParts[1]);

  if (
    Number.isNaN(sh) ||
    Number.isNaN(sm) ||
    Number.isNaN(eh) ||
    Number.isNaN(em)
  ) {
    return 0;
  }

  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;

  if (endMin < startMin) {
    endMin += 24 * 60;
  }

  return Math.max(0, endMin - startMin);
}

function ratio(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const adminDailyReportRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/daily-report/overview",
    {
      preHandler: [requireAuth],
      schema: getAdminDailyReportOverviewSchema,
    },
    async (req: any, reply) => {
      const authUserId = req.user?.sub as string;

      const {
        startDate,
        endDate,
        teamId = "ALL",
        projectId = "ALL",
        keyword = "",
      } = req.query as {
        startDate: string;
        endDate: string;
        teamId?: string;
        projectId?: string;
        keyword?: string;
      };

      const me = await app.prisma.user.findUnique({
        where: { userId: authUserId },
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

      if (me.globalRole !== "ADMIN") {
        return reply.status(403).send({
          code: "ADMIN_FORBIDDEN",
          message: "admin only",
        });
      }

      const normalizedKeyword = String(keyword ?? "").trim();

      const where: any = {
        reportDate: {
          gte: toDateOnly(startDate),
          lt: nextDate(endDate),
        },
      };

      if (teamId && teamId !== "ALL") {
        where.teamId = teamId;
      }

      if (projectId && projectId !== "ALL") {
        where.projectId = projectId;
      }

      if (normalizedKeyword.length > 0) {
        where.OR = [
          {
            content: {
              contains: normalizedKeyword,
              mode: "insensitive",
            },
          },
          {
            user: {
              name: {
                contains: normalizedKeyword,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              id: {
                contains: normalizedKeyword,
                mode: "insensitive",
              },
            },
          },
          {
            project: {
              name: {
                contains: normalizedKeyword,
                mode: "insensitive",
              },
            },
          },
        ];
      }

      const entries = await app.prisma.dailyReportEntry.findMany({
        where,
        orderBy: [
          { teamId: "asc" },
          { userId: "asc" },
          { reportDate: "asc" },
          { startTime: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          dailyReportEntryId: true,
          teamId: true,
          userId: true,
          reportDate: true,
          startTime: true,
          endTime: true,
          content: true,
          projectId: true,
          team: {
            select: {
              teamId: true,
              name: true,
            },
          },
          project: {
            select: {
              projectId: true,
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
        },
      });

      const teamWhere =
        teamId && teamId !== "ALL"
          ? {
              teamId,
            }
          : {};

      const totalUserCount = await app.prisma.teamMember.count({
        where: teamWhere,
      });

      const dates = getDateRange(startDate, endDate);

      const totalMinutes = entries.reduce((sum, entry) => {
        return sum + diffMinutes(entry.startTime, entry.endTime);
      }, 0);

      const reportedUserIds = new Set<string>();

      entries.forEach((entry) => {
        const minutes = diffMinutes(entry.startTime, entry.endTime);

        if (minutes > 0) {
          reportedUserIds.add(entry.userId);
        }
      });

      const projectMap = new Map<
        string,
        {
          projectId: string | null;
          projectName: string;
          projectColorCode: string | null;
          minutes: number;
        }
      >();

      entries.forEach((entry) => {
        const minutes = diffMinutes(entry.startTime, entry.endTime);
        const key = entry.projectId || "NONE";

        const current =
          projectMap.get(key) ||
          {
            projectId: entry.projectId || null,
            projectName: entry.project?.name || "미지정",
            projectColorCode: entry.project?.colorCode || null,
            minutes: 0,
          };

        current.minutes += minutes;
        projectMap.set(key, current);
      });

      const projectResources = [...projectMap.values()]
        .sort((a, b) => b.minutes - a.minutes)
        .map((item) => ({
          projectId: item.projectId,
          projectName: item.projectName,
          projectColorCode: item.projectColorCode,
          minutes: item.minutes,
          ratio: ratio(item.minutes, totalMinutes),
        }));

      const topProject = projectResources[0] || null;

      const teamMap = new Map<
        string,
        {
          teamId: string;
          teamName: string;
          pointsMap: Map<string, number>;
        }
      >();

      entries.forEach((entry) => {
        const minutes = diffMinutes(entry.startTime, entry.endTime);
        const d = dateKey(entry.reportDate);

        const current =
          teamMap.get(entry.teamId) ||
          {
            teamId: entry.teamId,
            teamName: entry.team?.name || "-",
            pointsMap: new Map<string, number>(),
          };

        current.pointsMap.set(d, (current.pointsMap.get(d) || 0) + minutes);
        teamMap.set(entry.teamId, current);
      });

      const teamTrend = [...teamMap.values()]
        .sort((a, b) => a.teamName.localeCompare(b.teamName))
        .map((team) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          points: dates.map((date) => ({
            date,
            minutes: team.pointsMap.get(date) || 0,
          })),
        }));

      const userMap = new Map<
        string,
        {
          userId: string;
          name: string;
          email: string | null;
          teamId: string | null;
          teamName: string;
          totalMinutes: number;
          entries: Array<{
            dailyReportEntryId: string;
            reportDate: string;
            startTime: string;
            endTime: string;
            projectId: string | null;
            projectName: string;
            projectColorCode: string | null;
            content: string | null;
            minutes: number;
          }>;
        }
      >();

      entries.forEach((entry) => {
        const minutes = diffMinutes(entry.startTime, entry.endTime);
        const userName = entry.user?.name || entry.user?.id || entry.userId;
        const email = entry.user?.id || null;

        const current =
          userMap.get(entry.userId) ||
          {
            userId: entry.userId,
            name: userName,
            email,
            teamId: entry.teamId,
            teamName: entry.team?.name || "-",
            totalMinutes: 0,
            entries: [],
          };

        current.totalMinutes += minutes;

        current.entries.push({
          dailyReportEntryId: entry.dailyReportEntryId,
          reportDate: dateKey(entry.reportDate),
          startTime: entry.startTime,
          endTime: entry.endTime,
          projectId: entry.projectId || null,
          projectName: entry.project?.name || "미지정",
          projectColorCode: entry.project?.colorCode || null,
          content: entry.content,
          minutes,
        });

        userMap.set(entry.userId, current);
      });

      const users = [...userMap.values()].sort((a, b) => {
        if (a.teamName !== b.teamName) {
          return a.teamName.localeCompare(b.teamName);
        }

        if (b.totalMinutes !== a.totalMinutes) {
          return b.totalMinutes - a.totalMinutes;
        }

        return a.name.localeCompare(b.name);
      });

      const dayCount = Math.max(dates.length, 1);
      const reportedUserCount = reportedUserIds.size;

      return reply.send({
        summary: {
          totalMinutes,
          reportRate: ratio(reportedUserCount, totalUserCount),
          reportedUserCount,
          totalUserCount,
          topProjectName: topProject?.projectName || null,
          topProjectRatio: topProject?.ratio || 0,
          avgHoursPerDay:
            reportedUserCount > 0
              ? round1(totalMinutes / reportedUserCount / dayCount / 60)
              : 0,
        },
        teamTrend,
        projectResources,
        users,
      });
    }
  );
};

export default adminDailyReportRoutes;