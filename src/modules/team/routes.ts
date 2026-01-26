import type { FastifyPluginAsync } from "fastify";
import { joinTeamSchema } from "./schema.js";
import { requireAuth } from "../../common/middleware/auth.js";

const base ="/teams"
const teamRoutes: FastifyPluginAsync = async (app) => {
  // 팀 참가 (JWT 사용자)
  app.post(`${base}/join`,
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
        data: {
          teamId: team.teamId,
          userId,
          role: "MEMBER",
        },
      });

      return reply.send({ ok: true, teamId: team.teamId });
    }
  );
};

export default teamRoutes;
