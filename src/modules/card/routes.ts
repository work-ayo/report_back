import type { FastifyPluginAsync } from "fastify";
import { requireAuth, assertTeamMemberByBoard } from "../../common/middleware/auth.js";
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



const cardRoutes: FastifyPluginAsync = async (app) => {
app.post(
  "/card",
  { preHandler: [requireAuth], schema: createCardSchema },
  async (req: any, reply) => {
    const userId = req.user.sub as string;

    const body = req.body as {
      columnId: string;
      title: string;
      content?: string;
      projectId?: string;
      dueDate?: string; // ISO string
    };

    const columnId = body.columnId.trim();
    const title = body.title.trim();
    const content = (body.content ?? "").trim();
    const projectId = (body.projectId ?? "").trim() || null;

    const dueDate = parseIsoDateOrNull(body.dueDate);
    if (body.dueDate && !dueDate) {
      return reply.status(400).send({ code: "INVALID_DUEDATE", message: "invalid dueDate" });
    }

    const column = await app.prisma.column.findUnique({
      where: { columnId },
      select: { columnId: true, boardId: true },
    });
    if (!column) return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });

    // 팀 멤버/ADMIN 체크
    const auth = await assertTeamMemberByBoard(app, userId, column.boardId);
    if (!auth.ok) return reply.status(auth.status).send({ code: auth.code, message: auth.message });

    // 보드의 teamId 가져오기(프로젝트 검증에 필요)
    const board = await app.prisma.board.findUnique({
      where: { boardId: column.boardId },
      select: { teamId: true },
    });
    if (!board) return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });

    // projectId가 있으면 같은 팀 프로젝트인지 확인
    if (projectId) {
      const project = await app.prisma.project.findUnique({
        where: { projectId },
        select: { teamId: true },
      });
      if (!project) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });
      if (project.teamId !== board.teamId) {
        return reply.status(400).send({ code: "INVALID_PROJECT", message: "project is not in the same team" });
      }
    }

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
        projectId,
        dueDate, // Date | null
        order: nextOrder,
        createdByUserId: userId,
      },
      select: {
        cardId: true,
        boardId: true,
        columnId: true,
        title: true,
        content: true,
        projectId: true,
        dueDate: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.code(201).send({
      card: {
        ...card,
        dueDate: card.dueDate ? iso(card.dueDate) : null,
        createdAt: iso(card.createdAt),
        updatedAt: iso(card.updatedAt),
      },
    });
  }
);

app.patch(
  "/card/:cardId",
  { preHandler: [requireAuth], schema: updateCardSchema },
  async (req: any, reply) => {
    const userId = req.user.sub as string;
    const cardId = req.params.cardId as string;

    const body = req.body as {
      title?: string;
      content?: string;
      projectId?: string; // optional
      dueDate?: string;   // ISO string, ""이면 해제
    };

    const existing = await app.prisma.card.findUnique({
      where: { cardId },
      select: { cardId: true, boardId: true },
    });
    if (!existing) return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });

    const auth = await assertTeamMemberByBoard(app, userId, existing.boardId);
    if (!auth.ok) return reply.status(auth.status).send({ code: auth.code, message: auth.message });

    const data: any = {};

    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) return reply.status(400).send({ code: "TITLE_REQUIRED", message: "title required" });
      data.title = t;
    }

    if (body.content !== undefined) {
      const c = body.content.trim();
      data.content = c.length > 0 ? c : null;
    }

    // dueDate: 빈문자열이면 null(해제), 값 있으면 ISO 파싱
    if (body.dueDate !== undefined) {
      const s = body.dueDate.trim();
      if (!s) {
        data.dueDate = null;
      } else {
        const d = parseIsoDateOrNull(s);
        if (!d) return reply.status(400).send({ code: "INVALID_DUEDATE", message: "invalid dueDate" });
        data.dueDate = d;
      }
    }

    // projectId: 빈문자열이면 null(해제), 값 있으면 같은 팀인지 검증
    if (body.projectId !== undefined) {
      const pid = body.projectId.trim();
      if (!pid) {
        data.projectId = null;
      } else {
        const board = await app.prisma.board.findUnique({
          where: { boardId: existing.boardId },
          select: { teamId: true },
        });
        if (!board) return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });

        const project = await app.prisma.project.findUnique({
          where: { projectId: pid },
          select: { teamId: true },
        });
        if (!project) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });
        if (project.teamId !== board.teamId) {
          return reply.status(400).send({ code: "INVALID_PROJECT", message: "project is not in the same team" });
        }

        data.projectId = pid;
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
    }

    const card = await app.prisma.card.update({
      where: { cardId },
      data,
      select: {
        cardId: true,
        boardId: true,
        columnId: true,
        title: true,
        content: true,
        projectId: true,
        dueDate: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send({
      card: {
        ...card,
        dueDate: card.dueDate ? iso(card.dueDate) : null,
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
