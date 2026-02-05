import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { env } from "../../../config/env.js";
import { requireAuth, requireAdmin } from "../../common/middleware/auth.js";
import {
  adminSetUserRoleSchema,
  adminCreateUserSchema,
  adminListUsersSchema,
  adminDeleteUserSchema,
  adminResetPasswordSchema,

} from "./schema.js";

const base = "/admin";

const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminPreHandler = [requireAuth, requireAdmin(app)];

  app.get(
    `${base}/users`,
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
          // 유저가 속한 팀들
          memberships: {
            select: {
              role: true, // teamMember에 role 컬럼 있으면
              team: {
                select: {
                  teamId: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // 응답 shape 깔끔하게: teamMembers -> teams
      const mapped = users.map((u) => ({
        userId: u.userId,
        id: u.id,
        name: u.name,
        department: u.department,
        globalRole: u.globalRole,
        isActive: u.isActive,
        teams: (u.memberships ?? []).map((m) => ({
          teamId: m.team.teamId,
          name: m.team.name,
          role: m.role ?? null,
        })),
      }));

      return reply.send({ users: mapped });
    }
  );


  // 비밀번호 초기화
  app.post(
    `${base}/users/:userId/password`,
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
    `${base}/users`,
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

      return reply.code(201).send({ user });
    }
  );

  app.delete(
    `${base}/users/:userId`,
    { preHandler: adminPreHandler, schema: adminDeleteUserSchema },
    async (req: any, reply) => {
      const targetUserId = req.params.userId as string;
      const me = req.user.sub as string;

      // 본인 삭제 금지
      if (me === targetUserId) {
        return reply.code(400).send({ code: "CANNOT_DELETE_SELF", message: "cannot delete self" });
      }

      const target = await app.prisma.user.findUnique({
        where: { userId: targetUserId },
        select: { userId: true, globalRole: true },
      });
      if (!target) {
        return reply.code(404).send({ code: "USER_NOT_FOUND", message: "user not found" });
      }

      // 마지막 ADMIN 삭제 금지
      if (target.globalRole === "ADMIN") {
        const adminCount = await app.prisma.user.count({
          where: { globalRole: "ADMIN", isActive: true },
        });
        if (adminCount <= 1) {
          return reply.code(400).send({ code: "LAST_ADMIN", message: "cannot delete the last admin" });
        }
      }

      await app.prisma.user.delete({ where: { userId: targetUserId } });

      return reply.send({ ok: true });
    }
  );



  // 유저 권한 변경 (ADMIN)
  app.patch(
    `${base}/users/:userId/role`,
    { preHandler: adminPreHandler, schema: adminSetUserRoleSchema },
    async (req: any, reply) => {
      const targetUserId = req.params.userId as string;
      const body = req.body as { globalRole: "ADMIN" | "USER" };
      const globalRole = body.globalRole;

      // 본인 강등 방지(ADMIN 1명)
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
