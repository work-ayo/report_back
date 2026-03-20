import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { requireAuth } from "../../common/middleware/auth.js";
import { E } from "../../common/errors.js";
import {
  signupSchema,
  loginSchema,
  meSchema,
  patchMeSchema,
  refreshSchema,
  logoutSchema,
} from "./schema.js";
import { env } from "../../config/env.js";
import { generateRefreshToken, hashToken } from "./util.js";

const base = "/auth";
const ACCESS_TOKEN_EXPIRES_IN = env.ACCESS_TOKEN_EXPIRES_IN;

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(`${base}/signup`, { schema: signupSchema }, async (req, reply) => {
    const body = req.body as { id: string; password: string; name: string;    department?: string; };

    const id = body.id?.trim();
    const password = (body.password ?? "").trim();
    const name = body.name?.trim();
    const department = body.department?.trim()

    if (!id || id.length < 3) throw E.badRequest("ID_TOO_SHORT", "id too short");
    if (!password || password.length < 8) throw E.badRequest("PASSWORD_TOO_SHORT", "password too short");
    if (!name) throw E.badRequest("NAME_REQUIRED", "name required");

    const exists = await app.prisma.user.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (exists) throw E.conflict("DUPLICATE_ID", "id already exists");

    const hashed = await argon2.hash(password);

    const user = await app.prisma.user.create({
      data: {
        id,
        password: hashed,
        name,
        department: body.department?.trim() || null,
        isActive: true,
      },
      select: { userId: true, id: true, name: true, isActive: true ,globalRole:true},
    });

    const accessToken = app.jwt.sign(
      { sub: user.userId },
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    return reply.code(201).send({ accessToken, user });
  });

  app.post(`${base}/login`, { schema: loginSchema }, async (req: any, reply) => {
    const body = req.body as { id: string; password: string };

    const id = body.id?.trim();
    const password = (body.password ?? "").trim();

    req.log.info(
      {
        origin: req.headers.origin ?? null,
        host: req.headers.host ?? null,
        referer: req.headers.referer ?? null,
        cookieHeader: req.headers.cookie ?? null,
      },
      "login request info"
    );

    if (!id || !password) throw E.unauthorized("1", "check id or password");

    const user = await app.prisma.user.findUnique({
      where: { id },
      select: { userId: true, id: true, name: true, isActive: true, password: true },
    });

    if (!user || !user.isActive) throw E.unauthorized("1", "check id or password");

    const ok = await argon2.verify(user.password, password);
    if (!ok) throw E.unauthorized("1", "check id or password");

    // req.log.info({ userId: user.userId }, "login success - issuing tokens");

    const accessToken = app.jwt.sign(
      { sub: user.userId },
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await app.prisma.refreshToken.create({
      data: {
        userId: user.userId,
        tokenHash,
        expiresAt,
      },
    });

    reply.setCookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    // req.log.info(
    //   {
    //     userId: user.userId,
    //     cookieName: "refreshToken",
    //     secure: false,
    //     sameSite: "lax",
    //     path: "/",
    //     expiresAt,
    //   },
    //   "refresh cookie set on response"
    // );

    return reply.send({
      accessToken,
      user: {
        userId: user.userId,
        id: user.id,
        name: user.name,
        isActive: user.isActive,
      },
    });
  });

  app.post(`${base}/refresh`, { schema: refreshSchema }, async (req: any, reply) => {
    const token = req.cookies.refreshToken;

    // req.log.info(
    //   {
    //     origin: req.headers.origin ?? null,
    //     host: req.headers.host ?? null,
    //     referer: req.headers.referer ?? null,
    //     cookieHeader: req.headers.cookie ?? null,
    //     parsedCookieKeys: Object.keys(req.cookies ?? {}),
    //     hasRefreshToken: !!token,
    //   },
    //   "refresh start"
    // );

    if (!token) {
      req.log.warn("refresh fail: NO_TOKEN");
      throw E.unauthorized("NO_TOKEN", "no refresh token");
    }

    const tokenHash = hashToken(token);

    const stored = await app.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      req.log.warn("refresh fail: INVALID_TOKEN");
      throw E.unauthorized("INVALID_TOKEN", "invalid token");
    }

    if (stored.revokedAt) {
      req.log.warn({ revokedAt: stored.revokedAt }, "refresh fail: TOKEN_REVOKED");
      throw E.unauthorized("TOKEN_REVOKED", "token revoked");
    }

    if (stored.expiresAt < new Date()) {
      req.log.warn({ expiresAt: stored.expiresAt }, "refresh fail: TOKEN_EXPIRED");
      throw E.unauthorized("TOKEN_EXPIRED", "token expired");
    }

    const user = await app.prisma.user.findUnique({
      where: { userId: stored.userId },
      select: { userId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      req.log.warn({ userId: stored.userId }, "refresh fail: USER_NOT_FOUND");
      throw E.unauthorized("USER_NOT_FOUND", "user not found");
    }

    const accessToken = app.jwt.sign(
      { sub: user.userId },
      { expiresIn: "30s" }
    );

    req.log.info({ userId: user.userId }, "refresh success");

    return reply.send({ accessToken });
  });

  app.post(`${base}/logout`, { schema: logoutSchema }, async (req: any, reply) => {
    const token = req.cookies.refreshToken;

    if (token) {
      const tokenHash = hashToken(token);

      await app.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }

    reply.clearCookie("refreshToken", { path: "/" });

    return reply.send({ ok: true });
  });

app.get(`${base}/me`, { preHandler: [requireAuth], schema: meSchema }, async (req: any, reply) => {
  const userId = req.user?.sub as string;
  if (!userId) throw E.unauthorized("UNAUTHORIZED", "unauthorized");

  const user = await app.prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      globalRole:true,
      department:true
    },
  });
  if (!user || !user.isActive) throw E.unauthorized("UNAUTHORIZED", "unauthorized");

  return reply.send({ user });
});


app.patch(`${base}/me`, { preHandler: [requireAuth], schema: patchMeSchema }, async (req: any, reply) => {
  const userId = req.user?.sub as string;
  if (!userId) throw E.unauthorized("UNAUTHORIZED", "unauthorized");

  const body = req.body as {
    name?: string;
    password?: string;
    newPassword?: string;
    primaryCardId?: number | null;
  };

  const name = body.name?.trim();
  const password = (body.password ?? "").trim();
  const newPassword = (body.newPassword ?? "").trim();

  const wantChangeName = name !== undefined && name.length > 0;
  const wantChangePassword = password.length > 0 && newPassword.length > 0;

  if (!wantChangeName && !wantChangePassword) {
    throw E.badRequest("NO_FIELDS", "no fields to update");
  }

  if ((password.length > 0 || newPassword.length > 0) && !wantChangePassword) {
    throw E.badRequest("MISSING_FIELDS", "missing password fields");
  }

  if (wantChangeName && name!.length > 100) {
    throw E.badRequest("NAME_TOO_LONG", "name too long");
  }

  if (wantChangePassword) {
    if (newPassword.length < 8) {
      throw E.badRequest("PASSWORD_TOO_SHORT", "password too short");
    }
    if (password === newPassword) {
      throw E.badRequest("SAME_PASSWORD", "new password must be different");
    }
  }

  const user = await app.prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      password: true,
      isActive: true,
      globalRole:true,
    },
  });

  if (!user || !user.isActive) {
    throw E.unauthorized("UNAUTHORIZED", "unauthorized");
  }

  const data: Record<string, any> = {};

  if (wantChangeName && name !== user.name) {
    data.name = name;
  }

  if (wantChangePassword) {
    const ok = await argon2.verify(user.password, password);
    if (!ok) {
      throw E.badRequest("INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다.");
    }
    data.password = await argon2.hash(newPassword);
  }



  if (Object.keys(data).length === 0) {
    throw E.badRequest("NO_FIELDS", "no fields to update");
  }

  await app.prisma.user.update({
    where: { userId },
    data,
  });

  return reply.send({ ok: true });
});
};

export default authRoutes;