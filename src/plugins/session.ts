import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

declare module "fastify" {
  interface Session {
    userId?: string;
  }
}

const sessionPlugin: FastifyPluginAsync = async (app) => {
  app.register(cookie);

  app.register(session, {
    secret: env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    },
    saveUninitialized: false,
  });
};

export default fp(sessionPlugin);
