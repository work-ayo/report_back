import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { env } from "../../../config/env.js";
import { requireAuth, requireAdmin } from "../../common/middleware/auth.js";
import { randomJoinCode } from "../../common/utils.js";
import {
  adminCreateTeamSchema,
  adminDeleteTeamSchema,
  adminSetUserRoleSchema,
  adminCreateUserSchema,
  adminListUsersSchema,
  adminResetPasswordSchema
} from "./schema.js";

const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminPreHandler = [requireAuth, requireAdmin(app)];

  app.get(
  "/admin/users",
  { preHandler: adminPreHandler, schema: adminListUsersSchema },
  async (_req, reply) => {
    const users = await app.prisma.user.findMany({
      select: {
        userId: true,
        id: true,
        name: true,
        department: true,
        globalRole: true,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({ users });
  }
);

// 비밀번호 초기화
app.post(
  "/admin/users/:userId/password",
  { preHandler: adminPreHandler, schema: adminResetPasswordSchema },
  async (req: any, reply) => {
    const targetUserId = req.params.userId as string;
    const body = req.body as { password?: string };

    const user = await app.prisma.user.findUnique({
      where: { userId: targetUserId },
      select: { userId: true },
    });
    if (!user) {
      return reply.code(404).send({
        code: "USER_NOT_FOUND",
        message: "user not found",
      });
    }

    const newPassword =
      body.password?.trim() || env.ADMIN_DEFAULT_PASSWORD;

    if (newPassword.length < 8) {
      return reply.code(400).send({
        code: "PASSWORD_TOO_SHORT",
        message: "password too short",
      });
    }

    const hashed = await argon2.hash(newPassword);

    await app.prisma.user.update({
      where: { userId: targetUserId },
      data: {
        password: hashed,
        lastLoginAt: null, // 선택: 초기화 시 로그인 이력 리셋
      },
    });

    return reply.send({
      ok: true,
      defaultPassword: newPassword,
    });
  }
);

    app.post(
    "/admin/users",
    { preHandler: adminPreHandler, schema: adminCreateUserSchema },
    async (req: any, reply) => {
      const body = req.body as {
        id: string;
        name: string;
        department?: string;
        globalRole?: "ADMIN" | "USER";
        password?: string;
      };

      const id = body.id?.trim();
      const name = body.name?.trim();
      const department = body.department?.trim() || null;
      const globalRole = body.globalRole ?? "USER";

      if (!id) return reply.code(400).send({ code: "ID_REQUIRED", message: "id required" });
      if (!name) return reply.code(400).send({ code: "NAME_REQUIRED", message: "name required" });

      const exists = await app.prisma.user.findUnique({ where: { id }, select: { userId: true } });
      if (exists) return reply.code(409).send({ code: "ID_EXISTS", message: "id already exists" });

      const defaultPassword = (body.password?.trim() || env.ADMIN_DEFAULT_PASSWORD).trim();
      if (defaultPassword.length < 8) {
        return reply.code(400).send({ code: "PASSWORD_TOO_SHORT", message: "password too short" });
      }

      const hashed = await argon2.hash(defaultPassword);

      const user = await app.prisma.user.create({
        data: {
          id,
          password: hashed, // 해시 저장(컬럼명은 password)
          name,
          department,
          globalRole,
        },
        select: { userId: true, id: true, name: true, department: true, globalRole: true },
      });

      // ADMIN이 발급한 초기 비밀번호를 응답으로 알려줌(운영에선 여기 노출 정책은 선택)
      return reply.code(201).send({ user, defaultPassword });
    }
  );

  // 팀 생성 (ADMIN)
  app.post(
    "/admin/teams",
    { preHandler: adminPreHandler, schema: adminCreateTeamSchema },
    async (req: any, reply) => {
      const body = req.body as { name: string };
      const name = body.name?.trim();
      if (!name) return reply.code(400).send({ code: "NAME_REQUIRED", message: "name required" });

      // joinCode 생성(충돌 시 재시도)
      let joinCode = randomJoinCode(8);
      for (let i = 0; i < 5; i++) {
        const exists = await app.prisma.team.findUnique({ where: { joinCode } });
        if (!exists) break;
        joinCode = randomJoinCode(8);
      }

      const team = await app.prisma.team.create({
        data: {
          name,
          joinCode,
          createdByUserId: req.user.sub,
        },
        select: { teamId: true, name: true, joinCode: true },
      });

      return reply.code(201).send({ team });
    }
  );

  // 팀 삭제 (ADMIN)
  app.delete(
    "/admin/teams/:teamId",
    { preHandler: adminPreHandler, schema: adminDeleteTeamSchema },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;

      const team = await app.prisma.team.findUnique({
        where: { teamId },
        select: { teamId: true },
      });
      if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

      await app.prisma.team.delete({ where: { teamId } });
      return reply.send({ ok: true });
    }
  );

  // 유저 권한 변경 (ADMIN)
  app.patch(
    "/admin/users/:userId/role",
    { preHandler: adminPreHandler, schema: adminSetUserRoleSchema },
    async (req: any, reply) => {
      const targetUserId = req.params.userId as string;
      const body = req.body as { globalRole: "ADMIN" | "USER" };
      const globalRole = body.globalRole;

      // 본인 강등 방지(ADMIN 1명 정책에 도움)
      const me = req.user.sub as string;
      if (me === targetUserId && globalRole !== "ADMIN") {
        return reply.code(400).send({ code: "CANNOT_DEMOTE_SELF", message: "cannot demote self" });
      }

      const exists = await app.prisma.user.findUnique({
        where: { userId: targetUserId },
        select: { userId: true },
      });
      if (!exists) return reply.code(404).send({ code: "USER_NOT_FOUND", message: "user not found" });

      const user = await app.prisma.user.update({
        where: { userId: targetUserId },
        data: { globalRole },
        select: { userId: true, id: true, name: true, globalRole: true },
      });

      return reply.send({ ok: true, user });
    }
  );
};

export default adminRoutes;
