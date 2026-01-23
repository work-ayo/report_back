import Fastify from "fastify";
import cors from "@fastify/cors";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import jwtPlugin from "./plugins/jwt.js";
import authRoutes from "./modules/auth/routes.js";

export default function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
  app.register(prismaPlugin);

  app.register(jwtPlugin);
  app.register(swaggerPlugin);

  app.register(authRoutes);

  app.get("/health", async () => ({ ok: true }));

  app.get("/health/db", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  return app;
}
