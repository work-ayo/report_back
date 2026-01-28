import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../common/middleware/auth.js";
import { createColumnSchema, updateColumnSchema, deleteColumnSchema, moveColumnSchema } from "./schema.js";

async function assertBoardAccess(app: any, userId: string, boardId: string) {
  const me = await app.prisma.user.findUnique({
    where: { userId },
    select: { globalRole: true, isActive: true },
  });
  if (!me || !me.isActive) return { ok: false as const, status: 401, code: "UNAUTHORIZED", message: "unauthorized" };
  if (me.globalRole === "ADMIN") return { ok: true as const };

  const board = await app.prisma.board.findUnique({
    where: { boardId },
    select: { teamId: true },
  });
  if (!board) return { ok: false as const, status: 404, code: "BOARD_NOT_FOUND", message: "board not found" };

  const member = await app.prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: board.teamId, userId } },
    select: { id: true },
  });
  if (!member) return { ok: false as const, status: 403, code: "FORBIDDEN", message: "forbidden" };

  return { ok: true as const };
}

const columnRoutes: FastifyPluginAsync = async (app) => {
  // 컬럼 생성
  app.post(
    "/columns",
    { preHandler: [requireAuth], schema: createColumnSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const body = req.body as { boardId: string; name: string; status?: string };

      const boardId = body.boardId.trim();
      const name = body.name.trim();
      const status = body.status ?? "CUSTOM";

      const access = await assertBoardAccess(app, userId, boardId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const last = await app.prisma.column.findFirst({
        where: { boardId },
        select: { order: true },
        orderBy: { order: "desc" },
      });
      const nextOrder = (last?.order ?? 0) + 1;

      const column = await app.prisma.column.create({
        data: { boardId, name, status, order: nextOrder },
        select: { columnId: true, boardId: true, name: true, status: true, order: true },
      });

      return reply.code(201).send({ column });
    }
  );

  // 컬럼 수정
  app.patch(
    "/columns/:columnId",
    { preHandler: [requireAuth], schema: updateColumnSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const columnId = req.params.columnId as string;
      const body = req.body as { name?: string; status?: string };

      const existing = await app.prisma.column.findUnique({
        where: { columnId },
        select: { columnId: true, boardId: true },
      });
      if (!existing) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

      const access = await assertBoardAccess(app, userId, existing.boardId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const data: any = {};
      if (body.name !== undefined) data.name = body.name.trim();
      if (body.status !== undefined) data.status = body.status;

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

      const column = await app.prisma.column.update({
        where: { columnId },
        data,
        select: { columnId: true, boardId: true, name: true, status: true, order: true },
      });

      return reply.send({ column });
    }
  );

  // 컬럼 삭제 + order 재정렬
  app.delete(
    "/columns/:columnId",
    { preHandler: [requireAuth], schema: deleteColumnSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const columnId = req.params.columnId as string;

      const existing = await app.prisma.column.findUnique({
        where: { columnId },
        select: { columnId: true, boardId: true },
      });
      if (!existing) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

      const access = await assertBoardAccess(app, userId, existing.boardId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      await app.prisma.$transaction(async (tx: any) => {
        await tx.column.delete({ where: { columnId } });

        // 남은 컬럼 order 재정렬(1..n)
        const cols = await tx.column.findMany({
          where: { boardId: existing.boardId },
          select: { columnId: true },
          orderBy: { order: "asc" },
        });

        for (let i = 0; i < cols.length; i++) {
          await tx.column.update({
            where: { columnId: cols[i].columnId },
            data: { order: i + 1 },
          });
        }
      });

      return reply.send({ ok: true });
    }
  );

  // 컬럼 이동 (order 재정렬)
  app.patch(
    "/columns/:columnId/move",
    { preHandler: [requireAuth], schema: moveColumnSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const columnId = req.params.columnId as string;
      const body = req.body as { toIndex: number };

      const existing = await app.prisma.column.findUnique({
        where: { columnId },
        select: { columnId: true, boardId: true },
      });
      if (!existing) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

      const access = await assertBoardAccess(app, userId, existing.boardId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const toIndex = Math.max(0, Number(body.toIndex));

      await app.prisma.$transaction(async (tx: any) => {
        const cols = await tx.column.findMany({
          where: { boardId: existing.boardId },
          select: { columnId: true },
          orderBy: { order: "asc" },
        });

        const ids = cols.map((c: any) => c.columnId).filter((id: string) => id !== columnId);
        const idx = Math.max(0, Math.min(toIndex, ids.length));
        ids.splice(idx, 0, columnId);

        for (let i = 0; i < ids.length; i++) {
          await tx.column.update({
            where: { columnId: ids[i] },
            data: { order: i + 1 },
          });
        }
      });

      return reply.send({ ok: true });
    }
  );
};

export default columnRoutes;
