import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
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
            { boardId: created.boardId, name: "To Do", status: "TODO", order: 1 },
            { boardId: created.boardId, name: "In Progress", status: "IN_PROGRESS", order: 2 },
            { boardId: created.boardId, name: "Done", status: "DONE", order: 3 },
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
    { preHandler: [requireAuth], schema: getBoardDetailSchema },
    async (req: any, reply) => {
      const boardId = req.params.boardId as string;
      const userId = req.user.sub as string;

      // 보드 + 팀 확인
      const board = await app.prisma.board.findUnique({
        where: { boardId },
        select: { boardId: true, teamId: true, name: true, createdByUserId: true, createdAt: true, updatedAt: true },
      });
      if (!board) return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });

      // 팀 멤버 체크
      const member = await app.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: board.teamId, userId } },
        select: { id: true },
      });
      if (!member) return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });

      const [columns, cards] = await Promise.all([
        app.prisma.column.findMany({
          where: { boardId },
          select: { columnId: true, boardId: true, name: true, status: true, order: true },
          orderBy: { order: "asc" },
        }),
        app.prisma.card.findMany({
          where: { boardId },
          select: { cardId: true, boardId: true, columnId: true, title: true, content: true, order: true, createdByUserId: true, createdAt: true, updatedAt: true },
          orderBy: [{ columnId: "asc" }, { order: "asc" }],
        }),
      ]);

      return reply.send({
        board: {
          ...board,
          createdAt: board.createdAt.toISOString(),
          updatedAt: board.updatedAt.toISOString(),
        },
        columns,
        cards: cards.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      });
    }
  );

  //보드삭제
  app.delete(
    "/boards/:boardId",
    {
      preHandler: [requireAuth],
      schema: deleteBoardSchema,
    },
    async (req: any, reply) => {
      const boardId = req.params.boardId as string;
      const userId = req.user.sub as string;

      // 보드 확인
      const board = await app.prisma.board.findUnique({
        where: { boardId },
        select: { boardId: true, teamId: true, createdByUserId: true },
      });
      if (!board) return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });

      // 작성자만 삭제 가능
      if (board.createdByUserId !== userId) {
        return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
      }

      // 보드 삭제
      await app.prisma.board.delete({
        where: { boardId },
      });

      return reply.send({ message: "Board deleted successfully" });
    }
  );  

  
};

export default boardRoutes;
