import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * JWT 인증 (app.decorate("authenticate", ...) 해둔 걸 사용)
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  // req.server === fastify instance
  // authenticate는 jwtPlugin에서 decorate한 함수

  const app = req.server as any;
  return app.authenticate(req, reply);
}

/**
 * 전역 ADMIN만 통과
 * - requireAuth 이후에 실행되는 걸 전제로 함
 */
export function requireAdmin(app: any) {
  return async (req: any, reply: any) => {
    const userId = req.user?.sub as string | undefined;
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const user = await app.prisma.user.findUnique({
      where: { userId },
      select: { globalRole: true, isActive: true },
    });

    if (!user || !user.isActive) return reply.code(401).send({ error: "unauthorized" });
    if (user.globalRole !== "ADMIN") return reply.code(403).send({ error: "forbidden" });
  };
}

/**
 * teamId를 params에서 가져와 팀 멤버인지 확인
 * - requireAuth 이후에 실행
 *
 */
export function requireTeamMember(app: any, getTeamId: (req: any) => string) {
  return async (req: any, reply: any) => {
    const userId = req.user?.sub as string | undefined;
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const teamId = getTeamId(req);
    if (!teamId) return reply.code(400).send({ error: "teamId required" });

    const member = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });

    if (!member) return reply.code(403).send({ error: "forbidden" });
  };
}
