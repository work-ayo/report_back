import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import sessionPlugin from "./plugins/session.js";      
import authRoutes from "./modules/auth/routes.js";   
import formbody from "@fastify/formbody";

export default function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });


  app.register(prismaPlugin);
  app.register(sessionPlugin);  
  app.register(swaggerPlugin);  
app.register(formbody);


  app.register(authRoutes); 

  app.get("/health", async () => ({ ok: true }));

  app.get("/health/db", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  return app;
}
