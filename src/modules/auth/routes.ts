import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";

const authRoutes: FastifyPluginAsync = async (app) => {
  // 회원가입
  app.post("/auth/signup", async (req, reply) => {
    const body = req.body as {
      id: string;         // 로그인 아이디
      password: string;   // 평문 입력
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
        password: hashed, // 컬럼명은 password지만 해시 저장
        name,
        department: body.department?.trim() || null,
      },
      select: { userId: true, id: true, name: true, department: true, globalRole: true },
    });

    const accessToken = app.jwt.sign({ sub: user.userId });

    return reply.code(201).send({ accessToken, user });
  });

  // 로그인
  app.post("/auth/login", async (req, reply) => {
    const body = req.body as { id: string; password: string };

    const id = body.id?.trim();
    const password = body.password ?? "";

    if (!id || !password) return reply.code(400).send({ error: "missing credentials" });

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user || !user.isActive) return reply.code(401).send({ error: "invalid credentials" });

    const ok = await argon2.verify(user.password, password);
    if (!ok) return reply.code(401).send({ error: "invalid credentials" });

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
  app.get("/auth/me", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
    const userId = req.user?.sub as string;

    const user = await app.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, id: true, name: true, department: true, globalRole: true, isActive: true },
    });

    if (!user || !user.isActive) return reply.code(401).send({ error: "unauthorized" });

    return reply.send({ user });
  });

  // 로그아웃 (JWT는 기본적으로 서버가 할 게 없음)
  app.post("/auth/logout", async (_req, reply) => {
    return reply.send({ ok: true });
  });
};

export default authRoutes;
