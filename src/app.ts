// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { Prisma } from "@prisma/client";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import jwtPlugin from "./plugins/jwt.js";
import { AppError } from "./common/errors.js";

import authRoutes from "./modules/auth/routes.js";
import teamRoutes from "./modules/team/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import weeklyRoutes from "./modules/weekly/routes.js";
import adminTeamRoutes from "./modules/admin/teams/routes.js";
import boardRoutes from "./modules/board/routes.js";
import cardRoutes from "./modules/card/routes.js";
import columnRoutes from "./modules/column/routes.js";
import adminProjectRoutes from "./modules/admin/project/routes.js";
import projectRoutes from "./modules/project/routes.js";
import summaryRoutes from "./modules/summary/routes.js";

export default function buildApp() {
  const app = Fastify({
    disableRequestLogging: true,
    logger: process.env.NODE_ENV === "production"
      ? true
      : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
            singleLine: true,
          },
        },
      }
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
      ? `(${status}) ${req.method} ${url} -> (user=${userId})`
      : `(${status}) ${req.method} ${url}`;

    req.log.info(msg);
  });


  //전역 에러 핸들러 (응답 + 로그 통일)
  app.setErrorHandler((err, req, reply) => {
    //fastify schema validation 에러
    if ((err as any).validation) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "invalid request",
        details: { validation: (err as any).validation },
      });
    }

    // Prisma 에러 매핑
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return reply.code(409).send({ code: "CONFLICT", message: "unique constraint failed", details: err.meta });
      }
      if (err.code === "P2003") {
        return reply.code(400).send({ code: "INVALID_REFERENCE", message: "foreign key constraint failed", details: err.meta });
      }
      if (err.code === "P2025") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "record not found", details: err.meta });
      }

      req.log.error({ err }, "prisma known error");
      return reply.code(500).send({ code: "INTERNAL_ERROR", message: "internal server error" });
    }

    // AppError
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        code: err.code,
        message: err.message,
        details: err.details,
      });
    }

    // 나머지
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send({ code: "INTERNAL_ERROR", message: "internal server error" });
  });

  app.register(cors, {
    origin: true, credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

  });
  app.register(formbody);

  app.register(prismaPlugin);
  app.register(jwtPlugin);

  app.register(swaggerPlugin);
  app.register(adminRoutes);
  app.register(adminTeamRoutes);
  app.register(adminProjectRoutes);

  app.register(summaryRoutes);



  app.register(authRoutes);
  app.register(projectRoutes);
  app.register(teamRoutes);
  app.register(weeklyRoutes);

  app.register(boardRoutes);
  app.register(cardRoutes);
  app.register(columnRoutes);


  app.get("/health", async () => ({ ok: true }));

  app.get("/health/db", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  return app;
}
