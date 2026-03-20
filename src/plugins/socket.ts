import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { Server as SocketIOServer } from "socket.io";

export type RealtimeServer = SocketIOServer;

declare module "fastify" {
  interface FastifyInstance {
    io: RealtimeServer;
  }
}

const socketPlugin: FastifyPluginAsync = async (app) => {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-board", (payload: { boardId: string }) => {
      const boardId = String(payload?.boardId ?? "").trim();
      if (!boardId) return;
      socket.join(`board:${boardId}`);
    });

    socket.on("leave-board", (payload: { boardId: string }) => {
      const boardId = String(payload?.boardId ?? "").trim();
      if (!boardId) return;
      socket.leave(`board:${boardId}`);
    });
  });

  app.decorate("io", io);

  app.addHook("onClose", async () => {
    await io.close();
  });
};

export default fp(socketPlugin, {
  name: "socket-plugin",
});