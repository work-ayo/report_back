// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";

import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import jwtPlugin from "./plugins/jwt.js";
import { AppError } from "./common/errors.js";

import authRoutes from "./modules/auth/routes.js";
import teamRoutes from "./modules/team/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import weeklyRoutes from "./modules/weekly/routes.js";

export default function buildApp() {
  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      transport:
        process.env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss.l",
                ignore: "pid,hostname,reqId",
                singleLine: true,
              },
            }
          : undefined,
    },
  });

    // 요청 로그(필요한 것만)
app.addHook("onResponse", async (req, reply) => {
  const url = req.url;

  if (
    url.startsWith("/docs") ||
    url.startsWith("/health") ||
    url.startsWith("/favicon")
  ) {
    return;
  }

  const status = reply.statusCode;
  const userId = (req as any).user?.sub as string | undefined;

  const msg = userId
    ? `${req.method} ${url} -> ${status} (user=${userId})`
    : `${req.method} ${url} -> ${status}`;

  req.log.info(msg);
});


  //전역 에러 핸들러 (응답 + 로그 통일)
  app.setErrorHandler((err, req, reply) => {
    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "internal server error";

    // Fastify validation 에러
    if ((err as any).validation) {
      statusCode = 400;
      code = "VALIDATION_ERROR";
      message = "invalid request";
    }

    // 커스텀 AppError
    if (err instanceof AppError) {
      statusCode = err.statusCode;
      code = err.code;
      message = err.message;
    }

    req.log.error(
      {
        err,
        statusCode,
        code,
        path: req.url,
        method: req.method,
        userId: (req as any).user?.sub,
      },
      "request failed"
    );

    return reply.code(statusCode).send({ code, message });
  });

  app.register(cors, { origin: true, credentials: true });
  app.register(formbody);

  app.register(prismaPlugin);
  app.register(jwtPlugin);

  app.register(swaggerPlugin);
  app.register(adminRoutes);
  app.register(authRoutes);
  app.register(teamRoutes);
  app.register(weeklyRoutes);


  app.get("/health", async () => ({ ok: true }));

  app.get("/health/db", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  return app;
}
