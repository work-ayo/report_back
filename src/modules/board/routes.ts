import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireBoardAccess, requireBoardOwnerOrAdmin, requireTeamMember } from "../../common/middleware/auth.js";
import { createBoardSchema, listBoardsSchema, getBoardDetailSchema,updateBoardSchema,deleteBoardSchema } from "./schema.js";

const boardRoutes: FastifyPluginAsync = async (app) => {

  // 팀 보드 목록 (팀 멤버만)
  app.get(
    "/teams/:teamId/boards",
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)],
      schema: listBoardsSchema,
    },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;

      const boards = await app.prisma.board.findMany({
        where: { teamId },
        select: { boardId: true, teamId: true, name: true, createdByUserId: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        boards: boards.map((b) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        })),
      });
    }
  );

  // 보드 생성 + 기본 컬럼 3개 생성 (팀 멤버 누구나)
  app.post(
    "/teams/:teamId/boards",
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)],
      schema: createBoardSchema,
    },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;
      const userId = req.user.sub as string;
      const body = req.body as { name: string };

      const name = body.name?.trim();
      if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

      const board = await app.prisma.$transaction(async (tx: any) => {
        const created = await tx.board.create({
          data: { teamId, name, createdByUserId: userId },
          select: { boardId: true, teamId: true, name: true, createdByUserId: true },
        });

        // 기본 컬럼 3개
       await tx.column.createMany({
      data: [
              { boardId: created.boardId, name: "TO DO", order: 1 },
              { boardId: created.boardId, name: "IN PROGRESS", order: 2 },
              { boardId: created.boardId, name: "DONE", order: 3 },
            ],
          });

        return created;
      });

      return reply.code(201).send({ board });
    }
  );

  // 보드 상세: columns + cards (팀 멤버만)
app.get(
  "/boards/:boardId",
  { preHandler: [requireAuth, requireBoardAccess(app)], schema: getBoardDetailSchema },
  async (req: any, reply) => {
    const boardId = req.params.boardId as string;

    const board = await app.prisma.board.findUnique({
      where: { boardId },
      select: {
        boardId: true,
        teamId: true,
        name: true,
        createdByUserId: true,
        createdBy:true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!board) return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });

    const [columns, cards] = await Promise.all([
      app.prisma.column.findMany({
        where: { boardId },
        select: { columnId: true, boardId: true, name: true, order: true},
        orderBy: { order: "asc" },
      }),

      app.prisma.card.findMany({
        where: { boardId },
        select: {
          cardId: true,
          boardId: true,
          columnId: true,
          dueDate:true,
          title: true,
          content: true,
          order: true,
          createdAt: true,
          updatedAt: true,
          project:true,
          createdBy: { select: { userId: true, name: true } }, 
        },
        orderBy: [{ columnId: "asc" }, { order: "asc" }],
      })

    ]);


    // cardsById
    const cardsById: Record<string, any> = {};
    for (const c of cards) {
      cardsById[c.cardId] = {
        ...c,
        dueDate: c.dueDate ? c.dueDate.toISOString() : null, 
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    }

    // cardIdsByColumnId (컬럼 순서와 무관하게 카드만 그룹)
   const cardIdsByColumnId: Record<string, string[]> = Object.create(null);

    for (const col of columns) {
      cardIdsByColumnId[col.columnId] = [];
    }

    for (const c of cards) {
      (cardIdsByColumnId[c.columnId] ??= []).push(c.cardId);
    }


    return reply.send({
      board: {
        ...board,
        createdAt: board.createdAt.toISOString(),
        updatedAt: board.updatedAt.toISOString(),
      },
      columns,
      cardsById,
      cardIdsByColumnId,
    });
  }
);



  //보드삭제
app.delete(
  "/boards/:boardId",
  { preHandler: [requireAuth], schema: deleteBoardSchema },
  async (req: any, reply) => {
    const boardId = req.params.boardId as string;
    const userId = req.user.sub as string;

    const board = await app.prisma.board.findUnique({
      where: { boardId },
      select: { boardId: true, teamId: true, createdByUserId: true },
    });
    if (!board) return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });

    //admin 여부 확인
    const me = await app.prisma.user.findUnique({
      where: { userId },
      select: { globalRole: true, isActive: true },
    });
    if (!me || !me.isActive) return reply.status(401).send({ code: "UNAUTHORIZED", message: "unauthorized" });

    const isAdmin = me.globalRole === "ADMIN";
    const isCreator = board.createdByUserId === userId;

    // 작성자 or 어드민
    if (!isAdmin && !isCreator) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }

    await app.prisma.board.delete({ where: { boardId } });

    return reply.send({ ok: true });
  }
);
app.patch(
  "/boards/:boardId",
  {
    preHandler: [requireAuth, requireBoardOwnerOrAdmin(app)],
    schema: updateBoardSchema,
  },
  async (req: any, reply) => {
    const boardId = req.params.boardId as string;
    const body = req.body as { name: string };
    const name = body.name?.trim();
    if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

    const updated = await app.prisma.board.update({
      where: { boardId },
      data: { name },
      select: { boardId: true, teamId: true, name: true, createdByUserId: true, createdAt: true, updatedAt: true },
    });

    return reply.send({
      board: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }
);


  
};

export default boardRoutes;
