import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";


export default function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
  app.register(cookie);
  app.register(prismaPlugin);
app.register(swaggerPlugin);

  app.get("/health", async () => ({ ok: true }));

  app.get("/health/db", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  return app;
}
