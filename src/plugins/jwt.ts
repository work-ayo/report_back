import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string }; // userId
    user: { sub: string };
  }
}

const jwtPlugin: FastifyPluginAsync = async (app) => {
  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
};

export default fp(jwtPlugin);
