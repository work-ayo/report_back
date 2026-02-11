import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../common/middleware/auth.js";
import { createColumnSchema, updateColumnSchema, deleteColumnSchema, moveColumnSchema } from "./schema.js";
import { Prisma } from "@prisma/client";

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
      const body = req.body as { boardId: string; name: string };

      const boardId = String(body.boardId ?? "").trim();
      const name = String(body.name ?? "").trim();

      if (!boardId) return reply.status(400).send({ code: "BOARDID_REQUIRED", message: "boardId required" });
      if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

      const access = await assertBoardAccess(app, userId, boardId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const last = await app.prisma.column.findFirst({
        where: { boardId },
        select: { order: true },
        orderBy: { order: "desc" },
      });
      const nextOrder = (last?.order ?? 0) + 1;

      try {
        const column = await app.prisma.column.create({
          data: { boardId, name, order: nextOrder, createdByUserId: userId },
          select: { columnId: true, boardId: true, name: true, order: true },
        });

        return reply.code(201).send({ column });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = (e.meta as any)?.target;
          const keys = Array.isArray(target) ? target.join(",") : String(target ?? "");

          if (keys.includes("name")) {
            return reply.status(409).send({ code: "COLUMN_NAME_EXISTS", message: "column name already exists" });
          }
          if (keys.includes("order")) {
            return reply.status(409).send({ code: "COLUMN_ORDER_CONFLICT", message: "column order conflict, retry" });
          }
          return reply.status(409).send({ code: "DUPLICATE", message: "duplicate column" });
        }
        throw e;
      }
    }
  );

  // 컬럼 수정
  app.patch(
    "/columns/:columnId",
    { preHandler: [requireAuth], schema: updateColumnSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const columnId = String(req.params.columnId ?? "").trim();
      const body = req.body as { name?: string };

      if (!columnId) return reply.status(400).send({ code: "COLUMNID_REQUIRED", message: "columnId required" });

      const existing = await app.prisma.column.findUnique({
        where: { columnId },
        select: { columnId: true, boardId: true },
      });
      if (!existing) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

      const access = await assertBoardAccess(app, userId, existing.boardId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const data: any = {};

      if (body.name !== undefined) {
        const nextName = String(body.name ?? "").trim();
        if (!nextName) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });
        data.name = nextName;
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

      try {
        const column = await app.prisma.column.update({
          where: { columnId },
          data,
          select: { columnId: true, boardId: true, name: true, order: true },
        });

        return reply.send({ column });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = (e.meta as any)?.target;
          const keys = Array.isArray(target) ? target.join(",") : String(target ?? "");

          if (keys.includes("name")) {
            return reply.status(409).send({ code: "COLUMN_NAME_EXISTS", message: "column name already exists" });
          }
          return reply.status(409).send({ code: "DUPLICATE", message: "duplicate column" });
        }
        throw e;
      }
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

        const cols = await tx.column.findMany({
          where: { boardId: existing.boardId },
          select: { columnId: true },
          orderBy: { order: "asc" },
        });

        const ids = cols.map((c: any) => c.columnId);

        // 임시 order로 먼저 이동 (중복 방지)
        for (let i = 0; i < ids.length; i++) {
          await tx.column.update({
            where: { columnId: ids[i] },
            data: { order: -100000 - i },
          });
        }

        // 최종 order 재부여 (0..n-1)
        for (let i = 0; i < ids.length; i++) {
          await tx.column.update({
            where: { columnId: ids[i] },
            data: { order: i },
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

        // 임시 order로 먼저 이동 (unique 충돌 방지)
        // 기존 order가 0..n 범위라고 가정하면 음수로 밀어두는 게 안전
        for (let i = 0; i < ids.length; i++) {
          await tx.column.update({
            where: { columnId: ids[i] },
            data: { order: -100000 - i },
          });
        }

        //최종 order 세팅
        for (let i = 0; i < ids.length; i++) {
          await tx.column.update({
            where: { columnId: ids[i] },
            data: { order: i },
          });
        }
      });

      return reply.send({ ok: true });
    }
  );

};

export default columnRoutes;
