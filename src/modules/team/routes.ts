import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import { joinTeamSchema, getMyTeamsSchema, leaveMyTeamSchema, TeamMemberListSchema } from "./schema.js";

const base = "/teams"
const teamRoutes: FastifyPluginAsync = async (app) => {
  // 팀 참가
  app.post(
    `${base}/join`,
    { preHandler: [requireAuth], schema: joinTeamSchema },
    async (req: any, reply) => {
      const userId = req.user?.sub as string;

      const body = req.body as { joinCode: string };
      const joinCode = body.joinCode?.trim();
      if (!joinCode) return reply.code(400).send({ code: "JOINCODE_REQUIRED", message: "joinCode required" });

      const team = await app.prisma.team.findUnique({
        where: { joinCode },
        select: { teamId: true },
      });
      if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

      const exists = await app.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: team.teamId, userId } },
        select: { id: true },
      });
      if (exists) return reply.code(409).send({ code: "ALREADY_JOINED", message: "already joined" });

      await app.prisma.teamMember.create({
        data: { teamId: team.teamId, userId, role: "MEMBER" },
      });

      return reply.send({ ok: true, teamId: team.teamId });
    }
  );

  // 내가 속한 팀 목록
  app.get(
    `${base}/me`,
    { preHandler: [requireAuth], schema: getMyTeamsSchema },
    async (req: any, reply) => {
      const userId = req.user?.sub as string;

      const memberships = await app.prisma.teamMember.findMany({
        where: { userId },
        select: {
          team: { select: { teamId: true, name: true, joinCode: true } },
        },
        orderBy: { joinedAt: "asc" },
      });

      const teams = memberships.map((m: any) => m.team);
      return reply.send({ teams });
    }
  );

  app.get(
    `${base}/:teamId/members`,
    {
      preHandler: [
        requireAuth,

        requireTeamMember(
          app,
          (req: any) =>
            req.params.teamId
        ),
      ],

      schema:
        TeamMemberListSchema,
    },

    async (
      req: any,
      reply
    ) => {
      const teamId =
        req.params.teamId as string;

      const team =
        await app.prisma.team.findUnique(
          {
            where: {
              teamId,
            },

            select: {
              teamId: true,
              name: true,
              joinCode: true,
            },
          }
        );

      if (!team) {
        return reply
          .code(404)
          .send({
            code:
              "TEAM_NOT_FOUND",

            message:
              "team not found",
          });
      }

      const members =
        await app.prisma.teamMember.findMany(
          {
            where: {
              teamId,
            },

            select: {
              role: true,

              user: {
                select: {
                  userId: true,
                  id: true,
                  name: true,
                  department: true,
                  globalRole: true,
                  isActive: true,
                },
              },
            },

            orderBy: {
              joinedAt: "asc",
            },
          }
        );

      return reply.send({
        team,

        members:
          members.map(
            (m: any) => ({
              role: m.role,

              userId:
                m.user.userId,

              id: m.user.id,

              name:
                m.user.name,

              department:
                m.user.department,

              globalRole:
                m.user
                  .globalRole,

              isActive:
                m.user
                  .isActive,
            })
          ),
      });
    }
  );


  app.delete(
    `${base}/:teamId/me`,
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)],
      schema: leaveMyTeamSchema,
    },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;
      const userId = req.user.sub as string;

      await app.prisma.teamMember.delete({
        where: {
          teamId_userId: { teamId, userId },
        },
      });

      return reply.send({ ok: true });
    }
  );

};

export default teamRoutes;
