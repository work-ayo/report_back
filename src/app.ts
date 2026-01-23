import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.register(cookie);

  app.get("/health", async () => {
    return { ok: true };
  });

  return app;
}
