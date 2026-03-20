// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { Prisma } from "@prisma/client";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import jwtPlugin from "./plugins/jwt.js";
import { AppError } from "./common/errors.js";
import cookie from "@fastify/cookie";

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

import socketPlugin  from "./plugins/socket.js";

import { logger } from "./common/logger.js";
import { env } from "./config/env.js";

function shouldSkipAccessLog(url: string) {
  return (
    url.startsWith("/docs") ||
    url.startsWith("/health") ||
    url.startsWith("/favicon")
  );
}


export default function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: true,
  });
  


  // 요청 로그(필요한 것만)
 app.addHook("onResponse", async (req, reply) => {
    if (shouldSkipAccessLog(req.url)) return;

    const userId = (req as any).user?.sub as string | undefined;
    const message = `${req.method} ${req.url} ${reply.statusCode} ${Math.round(
      reply.elapsedTime
    )}ms user=${userId ?? "-"}`;

    if (reply.statusCode >= 500) {
      req.log.error(message);
      return;
    }

    if (reply.statusCode >= 400) {
      req.log.warn(message);
      return;
    }

    req.log.info(message);
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

   
   app.register(cookie, {
    secret: env.COOKIE_SECRET,
  })

  app.register(socketPlugin); //소켓서버  
  app.register(formbody);
  app.register(prismaPlugin);
  app.register(jwtPlugin);
  app.register(
    async (api) => {
      api.register(swaggerPlugin);

      api.register(adminRoutes);
      api.register(adminTeamRoutes);
      api.register(adminProjectRoutes);

      api.register(summaryRoutes);

      api.register(authRoutes);
      api.register(projectRoutes);
      api.register(teamRoutes);
      api.register(weeklyRoutes);

      api.register(boardRoutes);
      api.register(cardRoutes);
      api.register(columnRoutes);

      api.get("/health", async () => ({ ok: true }));

      api.get("/health/db", async () => {
        await api.prisma.$queryRaw`SELECT 1`;
        return { ok: true };
      });
    },
    { prefix: "/api" }
  );
  return app;
}
