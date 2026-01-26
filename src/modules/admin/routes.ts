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
  adminDeleteUserSchema,
  adminResetPasswordSchema,
  adminAddTeamMemberSchema,
  adminRemoveTeamMemberSchema,
  adminListTeamMembersSchema,
  adminListTeamsSchema
} from "./schema.js";

const base = "/admin";
const team_base = `${base}/teams`;

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
        },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({ users });
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


  // 팀 생성 (ADMIN)
  app.post(
    `${team_base}`,
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
    `${team_base}/:teamId`,
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
  // 팀에 유저 추가 (ADMIN)
app.post(
  `${team_base}/:teamId/members`,
  { preHandler: adminPreHandler, schema: adminAddTeamMemberSchema },
  async (req: any, reply) => {
    const teamId = req.params.teamId as string;
    const body = req.body as { userId: string; role?: "MEMBER" };

    const userId = body.userId?.trim();
    if (!userId) return reply.code(400).send({ code: "USERID_REQUIRED", message: "userId required" });

    // 팀 존재 확인
    const team = await app.prisma.team.findUnique({ where: { teamId }, select: { teamId: true } });
    if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

    // 유저 존재 확인
    const user = await app.prisma.user.findUnique({ where: { userId }, select: { userId: true } });
    if (!user) return reply.code(404).send({ code: "USER_NOT_FOUND", message: "user not found" });

    // 이미 멤버면 409
    const exists = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    if (exists) return reply.code(409).send({ code: "ALREADY_MEMBER", message: "already a member" });

    await app.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "MEMBER",
      },
    });

    return reply.send({ ok: true, teamId, userId });
  }
);

// 팀에서 유저 제거 (ADMIN)
app.delete(
  `${team_base}/:teamId/members/:userId`,
  { preHandler: adminPreHandler, schema: adminRemoveTeamMemberSchema },
  async (req: any, reply) => {
    const teamId = req.params.teamId as string;
    const userId = req.params.userId as string;

    const member = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    if (!member) return reply.code(404).send({ code: "MEMBER_NOT_FOUND", message: "member not found" });

    await app.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    return reply.send({ ok: true });
  }
);

app.get(
  `${team_base}`,
  { preHandler: adminPreHandler, schema: adminListTeamsSchema },
  async (_req: any, reply) => {
    const teams = await app.prisma.team.findMany({
      select: { teamId: true, name: true, joinCode: true },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({ teams });
  }
);

//팀 멤버 목록 조회
app.get(
  `${team_base}:teamId/members`,
  { preHandler: adminPreHandler, schema: adminListTeamMembersSchema },
  async (req: any, reply) => {
    const teamId = req.params.teamId as string;

    const team = await app.prisma.team.findUnique({
      where: { teamId },
      select: { teamId: true },
    });
    if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

    const members = await app.prisma.teamMember.findMany({
      where: { teamId },
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
      orderBy: { joinedAt: "asc" },
    });

    return reply.send({
      members: members.map((m) => ({
        role: m.role,
        userId: m.user.userId,
        id: m.user.id,
        name: m.user.name,
        department: m.user.department,
        globalRole: m.user.globalRole,
        isActive: m.user.isActive,
      })),
    });
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
