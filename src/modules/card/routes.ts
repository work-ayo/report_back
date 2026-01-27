import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../common/middleware/auth.js";
import { createCardSchema, updateCardSchema, deleteCardSchema, moveCardSchema } from "./schema.js";

function iso(d: Date) {
  return d.toISOString();
}

async function assertTeamMemberByBoard(app: any, userId: string, boardId: string) {
  const board = await app.prisma.board.findUnique({
    where: { boardId },
    select: { teamId: true },
  });
  if (!board) return { ok: false as const, code: "BOARD_NOT_FOUND", message: "board not found" };

  const member = await app.prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: board.teamId, userId } },
    select: { id: true },
  });
  if (!member) return { ok: false as const, code: "FORBIDDEN", message: "forbidden" };

  return { ok: true as const };
}

const cardRoutes: FastifyPluginAsync = async (app) => {
  // 카드 생성
  app.post(
    "/card",
    { preHandler: [requireAuth], schema: createCardSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const body = req.body as { columnId: string; title: string; content?: string };

      const columnId = body.columnId.trim();
      const title = body.title.trim();
      const content = (body.content ?? "").trim();

      const column = await app.prisma.column.findUnique({
        where: { columnId },
        select: { columnId: true, boardId: true },
      });
      if (!column) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

      const auth = await assertTeamMemberByBoard(app, userId, column.boardId);
      if (!auth.ok) return reply.status(auth.code === "FORBIDDEN" ? 403 : 404).send({ code: auth.code, message: auth.message });

      // 해당 컬럼의 마지막 order + 1
      const last = await app.prisma.card.findFirst({
        where: { columnId },
        select: { order: true },
        orderBy: { order: "desc" },
      });
      const nextOrder = (last?.order ?? 0) + 1;

      const card = await app.prisma.card.create({
        data: {
          boardId: column.boardId,
          columnId,
          title,
          content: content.length > 0 ? content : null,
          order: nextOrder,
          createdByUserId: userId,
        },
      });

      return reply.code(201).send({
        card: {
          ...card,
          createdAt: iso(card.createdAt),
          updatedAt: iso(card.updatedAt),
        },
      });
    }
  );

  // 카드 수정
  app.patch(
    "/card/:cardId",
    { preHandler: [requireAuth], schema: updateCardSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const cardId = req.params.cardId as string;
      const body = req.body as { title?: string; content?: string };

      const existing = await app.prisma.card.findUnique({
        where: { cardId },
        select: { cardId: true, boardId: true },
      });
      if (!existing) return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });

      const auth = await assertTeamMemberByBoard(app, userId, existing.boardId);
      if (!auth.ok) return reply.status(auth.code === "FORBIDDEN" ? 403 : 404).send({ code: auth.code, message: auth.message });

      const data: any = {};
      if (body.title !== undefined) data.title = body.title.trim();
      if (body.content !== undefined) {
        const c = body.content.trim();
        data.content = c.length > 0 ? c : null;
      }
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

      const card = await app.prisma.card.update({
        where: { cardId },
        data,
      });

      return reply.send({
        card: {
          ...card,
          createdAt: iso(card.createdAt),
          updatedAt: iso(card.updatedAt),
        },
      });
    }
  );

  // 카드 삭제
  app.delete(
    "/card/:cardId",
    { preHandler: [requireAuth], schema: deleteCardSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const cardId = req.params.cardId as string;

      const existing = await app.prisma.card.findUnique({
        where: { cardId },
        select: { cardId: true, boardId: true, columnId: true, order: true },
      });
      if (!existing) return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });

      const auth = await assertTeamMemberByBoard(app, userId, existing.boardId);
      if (!auth.ok) return reply.status(auth.code === "FORBIDDEN" ? 403 : 404).send({ code: auth.code, message: auth.message });

      // 삭제 후 같은 columnId의 order 재정렬(빈 구멍 메우기)
      await app.prisma.$transaction(async (tx: any) => {
        await tx.card.delete({ where: { cardId } });

        const cards = await tx.card.findMany({
          where: { columnId: existing.columnId },
          select: { cardId: true },
          orderBy: { order: "asc" },
        });

        for (let i = 0; i < cards.length; i++) {
          await tx.card.update({
            where: { cardId: cards[i].cardId },
            data: { order: i + 1 },
          });
        }
      });

      return reply.send({ ok: true });
    }
  );

  // 카드 이동/정렬
  app.patch(
    "/card/:cardId/move",
    { preHandler: [requireAuth], schema: moveCardSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const cardId = req.params.cardId as string;
      const body = req.body as { toColumnId: string; toIndex: number };

      const toColumnId = body.toColumnId.trim();
      const toIndex = Number(body.toIndex);

      const card = await app.prisma.card.findUnique({
        where: { cardId },
        select: { cardId: true, boardId: true, columnId: true },
      });
      if (!card) return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });

      const auth = await assertTeamMemberByBoard(app, userId, card.boardId);
      if (!auth.ok) return reply.status(auth.code === "FORBIDDEN" ? 403 : 404).send({ code: auth.code, message: auth.message });

      const toColumn = await app.prisma.column.findUnique({
        where: { columnId: toColumnId },
        select: { columnId: true, boardId: true },
      });
      if (!toColumn) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

      // 다른 보드 컬럼으로 이동 방지
      if (toColumn.boardId !== card.boardId) {
        return reply.status(400).send({ code: "INVALID_TARGET", message: "target column is not in the same board" });
      }

      const fromColumnId = card.columnId;

      await app.prisma.$transaction(async (tx: any) => {
        // from 목록
        const fromCards = await tx.card.findMany({
          where: { columnId: fromColumnId },
          select: { cardId: true },
          orderBy: { order: "asc" },
        });

        // to 목록
        const toCards = fromColumnId === toColumnId
          ? fromCards
          : await tx.card.findMany({
              where: { columnId: toColumnId },
              select: { cardId: true },
              orderBy: { order: "asc" },
            });

        // fromCards에서 cardId 제거
        const fromIds = fromCards.map((c: any) => c.cardId).filter((id: string) => id !== cardId);

        if (fromColumnId === toColumnId) {
          // 같은 컬럼 내 이동
          const idx = Math.max(0, Math.min(toIndex, fromIds.length));
          fromIds.splice(idx, 0, cardId);

          // order 재정렬
          for (let i = 0; i < fromIds.length; i++) {
            await tx.card.update({ where: { cardId: fromIds[i] }, data: { order: i + 1 } });
          }
        } else {
          // 다른 컬럼으로 이동
          const toIds = toCards.map((c: any) => c.cardId);
          const idx = Math.max(0, Math.min(toIndex, toIds.length));
          toIds.splice(idx, 0, cardId);

          // card의 columnId 변경(일단 먼저)
          await tx.card.update({ where: { cardId }, data: { columnId: toColumnId } });

          // from 컬럼 order 재정렬
          for (let i = 0; i < fromIds.length; i++) {
            await tx.card.update({ where: { cardId: fromIds[i] }, data: { order: i + 1 } });
          }

          // to 컬럼 order 재정렬
          for (let i = 0; i < toIds.length; i++) {
            await tx.card.update({ where: { cardId: toIds[i] }, data: { order: i + 1 } });
          }
        }
      });

      return reply.send({ ok: true });
    }
  );
};

export default cardRoutes;
