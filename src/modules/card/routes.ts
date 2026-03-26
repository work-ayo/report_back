import type { FastifyPluginAsync } from "fastify";
import { requireAuth, assertTeamMemberByBoard, requireMyCard } from "../../common/middleware/auth.js";
import { createCardSchema, updateCardSchema, deleteCardSchema, moveCardSchema } from "./schema.js";

function iso(d: Date) {
  return d.toISOString();
}

function parseIsoDateOrNull(v: unknown): Date | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function calcOrderForInsert(
  prevOrder: number | null,
  nextOrder: number | null
): number | null {
  if (prevOrder === null && nextOrder === null) return 0;
  if (prevOrder === null) return nextOrder! - 1024;
  if (nextOrder === null) return prevOrder + 1024;

  const gap = nextOrder - prevOrder;
  if (gap <= 1) return null;

  return Math.floor((prevOrder + nextOrder) / 2);
}


const cardRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/card",
    { preHandler: [requireAuth], schema: createCardSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const requestId = req.headers["x-request-id"]
        ? String(req.headers["x-request-id"])
        : null;

      const body = req.body as {
        columnId: string;
        title: string;
        content?: string;
        projectId?: string;
        dueDate?: string;
        md?: number;
      };

      const columnId = String(body.columnId ?? "").trim();
      const title = String(body.title ?? "").trim();
      const content = String(body.content ?? "").trim();
      const projectId = String(body.projectId ?? "").trim() || null;
      const md = body.md ?? 0;

      if (md < 0) {
        return reply.status(400).send({ code: "INVALID_MD", message: "invalid md period" });
      }

      const dueDate = parseIsoDateOrNull(body.dueDate);
      if (body.dueDate && !dueDate) {
        return reply.status(400).send({ code: "INVALID_DUEDATE", message: "invalid dueDate" });
      }

      const column = await app.prisma.column.findUnique({
        where: { columnId },
        select: { columnId: true, boardId: true },
      });
      if (!column) {
        return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });
      }

      const auth = await assertTeamMemberByBoard(app, userId, column.boardId);
      if (!auth.ok) {
        return reply.status(auth.status).send({ code: auth.code, message: auth.message });
      }

      const board = await app.prisma.board.findUnique({
        where: { boardId: column.boardId },
        select: { teamId: true },
      });
      if (!board) {
        return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });
      }

      if (projectId) {
        const project = await app.prisma.project.findUnique({
          where: { projectId },
          select: { teamId: true },
        });
        if (!project) {
          return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });
        }
        if (project.teamId !== board.teamId) {
          return reply.status(400).send({ code: "INVALID_PROJECT", message: "project is not in the same team" });
        }
      }

      const first = await app.prisma.card.findFirst({
        where: { columnId },
        select: { order: true },
        orderBy: { order: "asc" },
      });
      const nextOrder = first ? first.order - 1 : -1;

      const card = await app.prisma.card.create({
        data: {
          boardId: column.boardId,
          columnId,
          title,
          content: content.length > 0 ? content : null,
          projectId,
          dueDate,
          order: nextOrder,
          createdByUserId: userId,
          md,
        },
        select: {
          cardId: true,
          boardId: true,
          columnId: true,
          title: true,
          content: true,
          order: true,
          projectId: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          md: true,
          createdByUserId: true,
          createdBy: { select: { userId: true, id: true, name: true } },
          project: {
            select: {
              projectId: true,
              teamId: true,
              code: true,
              name: true,
              price: true,
              startDate: true,
              endDate: true,
              colorCode: true,
            },
          },
        },
      });

      const payloadCard = {
        ...card,
        createdBy: card.createdBy ?? null,
        project: card.project
          ? {
              ...card.project,
              price: card.project.price.toString(),
              startDate: card.project.startDate ? iso(card.project.startDate) : "",
              endDate: card.project.endDate ? iso(card.project.endDate) : "",
            }
          : null,
        dueDate: card.dueDate ? iso(card.dueDate) : null,
        createdAt: iso(card.createdAt),
        updatedAt: iso(card.updatedAt),
        order:nextOrder,
      };

      app.io.to(`board:${card.boardId}`).emit("board:event", {
        type: "card:created",
        boardId: card.boardId,
        card: payloadCard,
        actorUserId: userId,
        requestId,
        updatedAt: new Date().toISOString(),
      });

      return reply.code(201).send({
        card: payloadCard,
      });
    }
  );

  //requireMyCard(app, (req: any) => req.params.cardId) 
  app.patch(
    "/card/:cardId",
    {
      preHandler: [requireAuth],
      schema: updateCardSchema,
    },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const cardId = req.params.cardId as string;
      const requestId = req.headers["x-request-id"]
        ? String(req.headers["x-request-id"])
        : null;

      const body = req.body as {
        title?: string;
        content?: string;
        projectId?: string;
        dueDate?: string;
        md?: number;
      };

      const existing = await app.prisma.card.findUnique({
        where: { cardId },
        select: { cardId: true, boardId: true },
      });
      if (!existing) {
        return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });
      }

      const auth = await assertTeamMemberByBoard(app, userId, existing.boardId);
      if (!auth.ok) {
        return reply.status(auth.status).send({ code: auth.code, message: auth.message });
      }

      const data: any = {};

      if (body.title !== undefined) {
        const t = String(body.title ?? "").trim();
        if (!t) {
          return reply.status(400).send({ code: "TITLE_REQUIRED", message: "title required" });
        }
        data.title = t;
      }

      if (body.content !== undefined) {
        const c = String(body.content ?? "").trim();
        data.content = c.length > 0 ? c : null;
      }

      if (body.dueDate !== undefined) {
        const s = String(body.dueDate ?? "").trim();
        if (!s) {
          data.dueDate = null;
        } else {
          const d = parseIsoDateOrNull(s);
          if (!d) {
            return reply.status(400).send({ code: "INVALID_DUEDATE", message: "invalid dueDate" });
          }
          data.dueDate = d;
        }
      }

      if (body.projectId !== undefined) {
        const pid = String(body.projectId ?? "").trim();

        if (!pid) {
          data.projectId = null;
        } else {
          const board = await app.prisma.board.findUnique({
            where: { boardId: existing.boardId },
            select: { teamId: true },
          });
          if (!board) {
            return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });
          }

          const project = await app.prisma.project.findUnique({
            where: { projectId: pid },
            select: { teamId: true },
          });
          if (!project) {
            return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });
          }
          if (project.teamId !== board.teamId) {
            return reply.status(400).send({ code: "INVALID_PROJECT", message: "project is not in the same team" });
          }

          data.projectId = pid;
        }
      }

      if (body.md !== undefined) {
        const md = Number(body.md);
        if (!Number.isInteger(md) || md < 0) {
          return reply.status(400).send({ code: "INVALID_MD", message: "invalid md period" });
        }
        data.md = md;
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

      data.updatedAt = new Date();

      const card = await app.prisma.card.update({
        where: { cardId },
        data,
        select: {
          cardId: true,
          boardId: true,
          columnId: true,
          title: true,
          content: true,
          dueDate: true,
          order: true,
          createdAt: true,
          updatedAt: true,
          md: true,
          projectId: true,
          createdByUserId: true,
          createdBy: {
            select: {
              userId: true,
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              projectId: true,
              teamId: true,
              code: true,
              name: true,
              price: true,
              startDate: true,
              endDate: true,
              colorCode: true,
            },
          },
        },
      });

      const payloadCard = {
        ...card,
        createdBy: card.createdBy ?? null,
        project: card.project
          ? {
              ...card.project,
              price: card.project.price.toString(),
              startDate: card.project.startDate ? iso(card.project.startDate) : "",
              endDate: card.project.endDate ? iso(card.project.endDate) : "",
            }
          : null,
        dueDate: card.dueDate ? iso(card.dueDate) : null,
        createdAt: iso(card.createdAt),
        updatedAt: iso(card.updatedAt),
      };

      app.io.to(`board:${card.boardId}`).emit("board:event", {
        type: "card:updated",
        boardId: card.boardId,
        card: payloadCard,
        actorUserId: userId,
        requestId,
        updatedAt: new Date().toISOString(),
      });

      return reply.send({
        card: payloadCard,
      });
    }
  );

  //TODO 권한
  // requireMyCard(app, (req: any) => req.params.cardId)
  app.delete(
    "/card/:cardId",
    { preHandler: [requireAuth], schema: deleteCardSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const cardId = req.params.cardId as string;
      const requestId = req.headers["x-request-id"]
        ? String(req.headers["x-request-id"])
        : null;

      const existing = await app.prisma.card.findUnique({
        where: { cardId },
        select: { cardId: true, boardId: true, columnId: true, order: true },
      });
      if (!existing) {
        return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });
      }

      const auth = await assertTeamMemberByBoard(app, userId, existing.boardId);
      if (!auth.ok) {
        return reply
          .status(auth.code === "FORBIDDEN" ? 403 : 404)
          .send({ code: auth.code, message: auth.message });
      }

await app.prisma.$transaction(async (tx: any) => {
  await tx.card.delete({ where: { cardId } });
});



      app.io.to(`board:${existing.boardId}`).emit("board:event", {
        type: "card:deleted",
        boardId: existing.boardId,
        cardId,
        columnId: existing.columnId,
        actorUserId: userId,
        requestId,
        updatedAt: new Date().toISOString(),
      });

      return reply.send({ ok: true });
    }
  );

app.patch(
  "/card/:cardId/move",
  { preHandler: [requireAuth], schema: moveCardSchema },
  async (req: any, reply) => {
    const actorUserId = String(req.user?.sub ?? "");
    const cardId = String(req.params.cardId ?? "");
    const toColumnId = String(req.body?.toColumnId ?? "");
    const toIndex = Number(req.body?.toIndex);
    const requestId = req.headers["x-request-id"]
      ? String(req.headers["x-request-id"])
      : null;

    if (!cardId || !toColumnId || Number.isNaN(toIndex) || toIndex < 0) {
      return reply.status(400).send({ code: "BAD_REQUEST" });
    }

    try {
      const result = await app.prisma.$transaction(async (tx: any) => {
        const card = await tx.card.findUnique({
          where: { cardId },
          select: {
            cardId: true,
            boardId: true,
            columnId: true,
            order: true,
            updatedAt: true,
          },
        });

        if (!card) {
          throw Object.assign(new Error("CARD_NOT_FOUND"), { statusCode: 404 });
        }

        const targetCol = await tx.column.findUnique({
          where: { columnId: toColumnId },
          select: { columnId: true, boardId: true },
        });

        if (!targetCol) {
          throw Object.assign(new Error("COLUMN_NOT_FOUND"), { statusCode: 404 });
        }

        if (card.boardId !== targetCol.boardId) {
          throw Object.assign(new Error("INVALID_MOVE"), { statusCode: 400 });
        }

        const boardId = card.boardId;
        const fromColumnId = card.columnId;
        const isSameColumn = fromColumnId === toColumnId;

        const movedUpdatedAt = isSameColumn ? null : new Date();

        const toCards = await tx.card.findMany({
          where: { columnId: toColumnId },
          orderBy: { order: "asc" },
          select: { cardId: true, order: true },
        });

        const filtered = toCards.filter((c: any) => c.cardId !== cardId);
        const idx = Math.max(0, Math.min(toIndex, filtered.length));

        const prev = idx > 0 ? filtered[idx - 1] : null;
        const next = idx < filtered.length ? filtered[idx] : null;

        const newOrder = calcOrderForInsert(prev?.order ?? null, next?.order ?? null);

        if (newOrder !== null) {
          await tx.card.update({
            where: { cardId },
            data: {
              columnId: toColumnId,
              order: newOrder,
              ...(movedUpdatedAt ? { updatedAt: movedUpdatedAt } : {}),
            },
          });
        } else {
          const rebased = [...filtered];
          rebased.splice(idx, 0, { cardId, order: 0 });

          // 1단계: unique 충돌 피하려고 임시 음수 order 부여
          for (let i = 0; i < rebased.length; i++) {
            await tx.card.update({
              where: { cardId: rebased[i].cardId },
              data: {
                order: -1000000 - i,
                ...(rebased[i].cardId === cardId
                  ? {
                      columnId: toColumnId,
                      ...(movedUpdatedAt ? { updatedAt: movedUpdatedAt } : {}),
                    }
                  : {}),
              },
            });
          }

          // 2단계: 최종 order 부여
          for (let i = 0; i < rebased.length; i++) {
            await tx.card.update({
              where: { cardId: rebased[i].cardId },
              data: {
                order: (i + 1) * 1024,
              },
            });
          }
        }

        const movedCard = await tx.card.findUnique({
          where: { cardId },
          select: {
            cardId: true,
            boardId: true,
            columnId: true,
            order: true,
            updatedAt: true,
          },
        });

        if (!movedCard) {
          throw Object.assign(new Error("CARD_NOT_FOUND"), { statusCode: 404 });
        }

        return {
          boardId,
          fromColumnId,
          toColumnId,
          toIndex: idx,
          card: movedCard,
        };
      });

      app.io.to(`board:${result.boardId}`).emit("board:event", {
        type: "card:moved",
        boardId: result.boardId,
        cardId: result.card.cardId,
        fromColumnId: result.fromColumnId,
        toColumnId: result.toColumnId,
        toIndex: result.toIndex,
        actorUserId,
        requestId,
        updatedAt: result.card.updatedAt.toISOString(),
      });

      return reply.send({
        ok: true,
        card: {
          ...result.card,
          updatedAt: result.card.updatedAt.toISOString(),
        },
      });
    } catch (e: any) {
      const code = Number(e?.statusCode ?? 500);
      return reply.status(code).send({
        code: e?.message ?? "INTERNAL_SERVER_ERROR",
        message: e?.message ?? "internal server error",
      });
    }
  }
);
};

export default cardRoutes;