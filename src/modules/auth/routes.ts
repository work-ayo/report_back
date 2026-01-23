import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { signupSchema, loginSchema, meSchema, logoutSchema } from "./schema.js";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/signup", { schema: signupSchema }, async (req, reply) => {
    const body = req.body as {
      username: string;
      password: string;
      name: string;
      department?: string;
    };

    const username = body.username?.trim();
    const password = body.password ?? "";
    const name = body.name?.trim();

    if (!username || username.length < 3) return reply.code(400).send({ error: "username too short" });
    if (!password || password.length < 8) return reply.code(400).send({ error: "password too short" });
    if (!name) return reply.code(400).send({ error: "name required" });

    const exists = await app.prisma.user.findUnique({ where: { username } });
    if (exists) return reply.code(409).send({ error: "username already exists" });

    const passwordHash = await argon2.hash(password);

    const user = await app.prisma.user.create({
      data: {
        username,
        passwordHash,
        name,
        department: body.department?.trim() || null,
      },
      select: { id: true, username: true, name: true, department: true, globalRole: true },
    });

    req.session.userId = user.id;

    return reply.code(201).send({ user });
  });

  app.post("/auth/login", { schema: loginSchema }, async (req, reply) => {
    const body = req.body as { username: string; password: string };

    const username = body.username?.trim();
    const password = body.password ?? "";

    if (!username || !password) return reply.code(400).send({ error: "missing credentials" });

    const user = await app.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) return reply.code(401).send({ error: "invalid credentials" });

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return reply.code(401).send({ error: "invalid credentials" });

    await app.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    req.session.userId = user.id;

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        department: user.department,
        globalRole: user.globalRole,
      },
    });
  });

  app.get("/auth/me", { schema: meSchema }, async (req, reply) => {
    const userId = req.session.userId;
    if (!userId) return reply.code(401).send({ user: null });

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, department: true, globalRole: true, isActive: true },
    });

    if (!user || !user.isActive) return reply.code(401).send({ user: null });

    return reply.send({ user });
  });

  app.post("/auth/logout", { schema: logoutSchema }, async (req, reply) => {
    await req.session.destroy();
    return reply.send({ ok: true });
  });
};

export default authRoutes;
