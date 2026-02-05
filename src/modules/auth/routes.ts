// src/modules/auth/routes.ts
import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { requireAuth } from "../../common/middleware/auth.js";
import {
  signupSchema,
  loginSchema,
  meSchema,
  changePasswordSchema
} from "./schema.js";
import { E } from "../../common/errors.js";

const base = "/auth";

const authRoutes: FastifyPluginAsync = async (app) => {
  // 회원가입
  app.post(`${base}/signup`, { schema: signupSchema }, async (req, reply) => {
    const body = req.body as {
      id: string; // 로그인 아이디
      password: string; 
      name: string;
      department?: string;
    };

    const id = body.id?.trim();
    const password = body.password ?? "";
    const name = body.name?.trim();

    if (!id || id.length < 3) return reply.code(400).send({ error: "id too short" });
    if (!password || password.length < 8) return reply.code(400).send({ error: "password too short" });
    if (!name) return reply.code(400).send({ error: "name required" });

    const exists = await app.prisma.user.findUnique({ where: { id } });
    if (exists) return reply.code(409).send({ error: "id already exists" });

    const hashed = await argon2.hash(password);

    const user = await app.prisma.user.create({
      data: {
        id,
        password: hashed,
        name,
        department: body.department?.trim() || null,
      },
      select: { userId: true, id: true, name: true, department: true, globalRole: true },
    });

    const accessToken = app.jwt.sign({ sub: user.userId });

    return reply.code(201).send({ accessToken, user });
  });

  // 로그인
  app.post(`${base}/login`, { schema: loginSchema }, async (req, reply) => {
    const body = req.body as { id: string; password: string };

    const id = body.id?.trim();
    const password = body.password ?? "";

    if (!id || !password) throw E.unauthorized("1", "check id or password");

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) throw E.unauthorized("1", "check id or password");

    const ok = await argon2.verify(user.password, password);
    if (!ok) throw E.unauthorized("1", "check password");

    await app.prisma.user.update({
      where: { userId: user.userId },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = app.jwt.sign({ sub: user.userId });

    return reply.send({
      accessToken,
      user: {
        userId: user.userId,
        id: user.id,
        name: user.name,
        department: user.department,
        globalRole: user.globalRole,
      },
    });
  });

  // 내 정보 (JWT 필요)
  app.get(
    `${base}/me`,
    { preHandler: (app as any).authenticate, schema: meSchema },
    async (req: any, reply) => {
      const userId = req.user?.sub as string;

      const user = await app.prisma.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          id: true,
          name: true,
          department: true,
          globalRole: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) return reply.status(401).send({ code: "UNAUTHORIZED", message: "unauthorized" });


      return reply.send({ user });
    }
  );


app.patch(
  `${base}/me`,
  { preHandler: [requireAuth], schema: changePasswordSchema },
  async (req: any, reply) => {
    const userId = req.user?.sub as string;

    const body = req.body as { name?: string; password?: string; newPassword?: string };

    const name = body.name?.trim();
    const password = (body.password ?? "").trim();
    const newPassword = (body.newPassword ?? "").trim();

    const wantChangeName = name !== undefined && name.length > 0;
    const wantChangePassword = password.length > 0 || newPassword.length > 0;

    // 아무 것도 안 보내면 400
    if (!wantChangeName && !wantChangePassword) {
      return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
    }

    // 비번 변경이면 둘 다 있어야 함
    if (wantChangePassword) {
      if (!password || !newPassword) {
        return reply.status(400).send({ code: "MISSING_FIELDS", message: "missing password fields" });
      }
      if (newPassword.length < 8) {
        return reply.status(400).send({ code: "PASSWORD_TOO_SHORT", message: "password too short" });
      }
      if (password === newPassword) {
        return reply.status(400).send({ code: "SAME_PASSWORD", message: "new password must be different" });
      }
    }

    const user = await app.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, password: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({ code: "UNAUTHORIZED", message: "unauthorized" });
    }

    const data: any = {};

    // 이름 변경
    if (wantChangeName) {
      if (name.length > 50) {
        return reply.status(400).send({ code: "NAME_TOO_LONG", message: "name too long" });
      }
      data.name = name;
    }

    // 비번 변경
    if (wantChangePassword) {
      const ok = await argon2.verify(user.password, password);
      if (!ok) {
        return reply.status(401).send({ code: "INVALID_PASSWORD", message: "invalid password" });
      }
      data.password = await argon2.hash(newPassword);
    }

    await app.prisma.user.update({
      where: { userId },
      data,
    });

    return reply.send({ ok: true });
  }
);


};

export default authRoutes;
