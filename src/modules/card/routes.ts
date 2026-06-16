import type { FastifyPluginAsync } from "fastify";

import {
  requireAuth,
  assertTeamMemberByBoard,
  requireMyCard,
} from "../../common/middleware/auth.js";

import {
  createCardSchema,
  updateCardSchema,
  deleteCardSchema,
  moveCardSchema,
} from "./schema.js";

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function dateOnly(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function parseDateOrNull(v: unknown): Date | null {
  const s = typeof v === "string" ? v.trim() : "";

  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);

    if (Number.isNaN(d.getTime())) return null;

    return d;
  }

  const d = new Date(s);

  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function sanitizeNullableString(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";

  return s || null;
}

function sanitizeProgress(v: unknown) {
  const n = Number(v ?? 0);

  if (!Number.isInteger(n)) return 0;

  return Math.min(100, Math.max(0, n));
}

function sanitizeMd(v: unknown) {
  const n = Number(v ?? 0);

  if (!Number.isInteger(n) || n < 0) return 0;

  return n;
}

function toProjectJson(project: any) {
  if (!project) return null;

  return {
    projectId: project.projectId,
    teamId: project.teamId,
    code: project.code,
    name: project.name,
    price: String(project.price ?? 0),
    startDate: dateOnly(project.startDate),
    endDate: dateOnly(project.endDate),
    colorCode: project.colorCode,
  };
}

function toUserMiniJson(user: any) {
  if (!user) return null;

  return {
    userId: user.userId,
    id: user.id,
    name: user.name,
    email: user.email ?? null,
  };
}

function toParentJson(parent: any) {
  if (!parent) return null;

  return {
    cardId: parent.cardId,
    title: parent.title,
  };
}

function toCardJson(card: any) {
  return {
    cardId: card.cardId,
    boardId: card.boardId,
    columnId: card.columnId,

    title: card.title,
    content: card.content ?? null,
    order: card.order,

    projectId: card.projectId ?? null,
    project: toProjectJson(card.project),

    parentCardId: card.parentCardId ?? null,
    parent: toParentJson(card.parent),

    assigneeUserId: card.assigneeUserId ?? null,
    assignee: toUserMiniJson(card.assignee),

    startDate: dateOnly(card.startDate),
    dueDate: dateOnly(card.dueDate),
    progress: Number(card.progress ?? 0),

    createdByUserId: card.createdByUserId,
    createdBy: toUserMiniJson(card.createdBy),

    createdAt: iso(card.createdAt),
    updatedAt: iso(card.updatedAt),
    contentUpdateAt: iso(card.contentUpdateAt),

    md: Number(card.md ?? 0),
  };
}

function cardInclude() {
  return {
    project: true,

    assignee: {
      select: {
        userId: true,
        id: true,
        name: true,
      },
    },

    parent: {
      select: {
        cardId: true,
        title: true,
      },
    },

    createdBy: {
      select: {
        userId: true,
        id: true,
        name: true,
      },
    },
  };
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
    {
      preHandler: [requireAuth],
      schema: createCardSchema,
    },
    async (req: any, reply) => {
      const userId = req.user.sub as string;

      const body = req.body as {
        columnId: string;
        title: string;
        content?: string | null;
        projectId?: string | null;
        dueDate?: string | null;
        startDate?: string | null;
        parentCardId?: string | null;
        assigneeUserId?: string | null;
        progress?: number;
        md?: number;
      };

      const columnId = String(body.columnId ?? "").trim();
      const title = String(body.title ?? "").trim();
      const content = sanitizeNullableString(body.content);
      const projectId = sanitizeNullableString(body.projectId);
      const parentCardId = sanitizeNullableString(body.parentCardId);
      const assigneeUserId = sanitizeNullableString(body.assigneeUserId);
      const md = sanitizeMd(body.md);
      const progress = sanitizeProgress(body.progress ?? body.md ?? 0);

      if (!columnId) {
        return reply.status(400).send({
          code: "COLUMN_REQUIRED",
          message: "columnId required",
        });
      }

      if (!title) {
        return reply.status(400).send({
          code: "TITLE_REQUIRED",
          message: "title required",
        });
      }

      const startDate = parseDateOrNull(body.startDate);
      const dueDate = parseDateOrNull(body.dueDate);

      if (body.startDate && !startDate) {
        return reply.status(400).send({
          code: "INVALID_STARTDATE",
          message: "invalid startDate",
        });
      }

      if (body.dueDate && !dueDate) {
        return reply.status(400).send({
          code: "INVALID_DUEDATE",
          message: "invalid dueDate",
        });
      }

      if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
        return reply.status(400).send({
          code: "INVALID_DATE_RANGE",
          message: "dueDate must be greater than or equal to startDate",
        });
      }

      const column = await app.prisma.column.findUnique({
        where: { columnId },
        select: {
          columnId: true,
          boardId: true,
        },
      });

      if (!column) {
        return reply.status(404).send({
          code: "COLUMN_NOT_FOUND",
          message: "column not found",
        });
      }

      const auth = await assertTeamMemberByBoard(
        app,
        userId,
        column.boardId
      );

      if (!auth.ok) {
        return reply.status(auth.status).send({
          code: auth.code,
          message: auth.message,
        });
      }

      const board = await app.prisma.board.findUnique({
        where: {
          boardId: column.boardId,
        },
        select: {
          boardId: true,
          teamId: true,
        },
      });

      if (!board) {
        return reply.status(404).send({
          code: "BOARD_NOT_FOUND",
          message: "board not found",
        });
      }

      if (projectId) {
        const project = await app.prisma.project.findFirst({
          where: {
            projectId,
            teamId: board.teamId,
          },
          select: {
            projectId: true,
          },
        });

        if (!project) {
          return reply.status(400).send({
            code: "INVALID_PROJECT",
            message: "project not found in this team",
          });
        }
      }

      if (assigneeUserId) {
        const assignee = await app.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: board.teamId,
              userId: assigneeUserId,
            },
          },
          select: {
            userId: true,
          },
        });

        if (!assignee) {
          return reply.status(400).send({
            code: "INVALID_ASSIGNEE",
            message: "assignee is not a member of this team",
          });
        }
      }

      if (parentCardId) {
        const parent = await app.prisma.card.findFirst({
          where: {
            cardId: parentCardId,
            boardId: board.boardId,
          },
          select: {
            cardId: true,
          },
        });

        if (!parent) {
          return reply.status(400).send({
            code: "INVALID_PARENT_CARD",
            message: "parent card not found in this board",
          });
        }
      }

      const last = await app.prisma.card.findFirst({
        where: { columnId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const order = last ? last.order + 1024 : 0;

      const created = await app.prisma.card.create({
        data: {
          boardId: board.boardId,
          columnId,

          title,
          content,

          projectId,
          parentCardId,
          assigneeUserId,

          startDate,
          dueDate,

          progress,
          md,

          order,
          createdByUserId: userId,
        },
        include: cardInclude(),
      });

      return reply.status(201).send({
        card: toCardJson(created),
      });
    }
  );

  app.patch(
    "/card/:cardId",
    {
      preHandler: [requireAuth],
      schema: updateCardSchema,
    },
    async (req: any, reply) => {
      const cardId = req.params.cardId as string;

      const body = req.body as {
        title?: string;
        content?: string | null;
        projectId?: string | null;
        parentCardId?: string | null;
        assigneeUserId?: string | null;
        startDate?: string | null;
        dueDate?: string | null;
        progress?: number;
        md?: number;
      };


      const existing = await app.prisma.card.findUnique({
        where: { cardId },
        select: {
          cardId: true,
          boardId: true,
          columnId: true,
          startDate: true,
          dueDate: true,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "CARD_NOT_FOUND",
          message: "card not found",
        });
      }

      const board = await app.prisma.board.findUnique({
        where: {
          boardId: existing.boardId,
        },
        select: {
          boardId: true,
          teamId: true,
        },
      });

      if (!board) {
        return reply.status(404).send({
          code: "BOARD_NOT_FOUND",
          message: "board not found",
        });
      }

      if (body.projectId !== undefined && body.projectId) {
        const project = await app.prisma.project.findFirst({
          where: {
            projectId: body.projectId,
            teamId: board.teamId,
          },
          select: {
            projectId: true,
          },
        });

        if (!project) {
          return reply.status(400).send({
            code: "INVALID_PROJECT",
            message: "project not found in this team",
          });
        }
      }

      if (body.assigneeUserId !== undefined && body.assigneeUserId) {
        const assignee = await app.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: board.teamId,
              userId: body.assigneeUserId,
            },
          },
          select: {
            userId: true,
          },
        });

        if (!assignee) {
          return reply.status(400).send({
            code: "INVALID_ASSIGNEE",
            message: "assignee is not a member of this team",
          });
        }
      }

      if (body.parentCardId !== undefined && body.parentCardId) {
        if (body.parentCardId === cardId) {
          return reply.status(400).send({
            code: "INVALID_PARENT_CARD",
            message: "card cannot be its own parent",
          });
        }

        const parent = await app.prisma.card.findFirst({
          where: {
            cardId: body.parentCardId,
            boardId: board.boardId,
          },
          select: {
            cardId: true,
            parentCardId: true,
          },
        });

        if (!parent) {
          return reply.status(400).send({
            code: "INVALID_PARENT_CARD",
            message: "parent card not found in this board",
          });
        }

        if (parent.parentCardId === cardId) {
          return reply.status(400).send({
            code: "INVALID_PARENT_CARD",
            message: "circular parent relation is not allowed",
          });
        }
      }

      const nextStartDate =
        body.startDate !== undefined
          ? parseDateOrNull(body.startDate)
          : existing.startDate;

      const nextDueDate =
        body.dueDate !== undefined
          ? parseDateOrNull(body.dueDate)
          : existing.dueDate;

      if (body.startDate && !nextStartDate) {
        return reply.status(400).send({
          code: "INVALID_STARTDATE",
          message: "invalid startDate",
        });
      }

      if (body.dueDate && !nextDueDate) {
        return reply.status(400).send({
          code: "INVALID_DUEDATE",
          message: "invalid dueDate",
        });
      }

      if (
        nextStartDate &&
        nextDueDate &&
        nextDueDate.getTime() < nextStartDate.getTime()
      ) {
        return reply.status(400).send({
          code: "INVALID_DATE_RANGE",
          message: "dueDate must be greater than or equal to startDate",
        });
      }

      const data: any = {};

      if (body.title !== undefined) {
        const title = String(body.title ?? "").trim();

        if (!title) {
          return reply.status(400).send({
            code: "TITLE_REQUIRED",
            message: "title required",
          });
        }

        data.title = title;
      }

      if (body.content !== undefined) {
        data.content = sanitizeNullableString(body.content);
        data.contentUpdateAt = new Date();
      }

      if (body.projectId !== undefined) {
        data.projectId = sanitizeNullableString(body.projectId);
      }

      if (body.parentCardId !== undefined) {
        data.parentCardId = sanitizeNullableString(body.parentCardId);
      }

      if (body.assigneeUserId !== undefined) {
        data.assigneeUserId = sanitizeNullableString(body.assigneeUserId);
      }

      if (body.startDate !== undefined) {
        data.startDate = nextStartDate;
      }

      if (body.dueDate !== undefined) {
        data.dueDate = nextDueDate;
      }

      if (body.progress !== undefined) {
        data.progress = sanitizeProgress(body.progress);
      }

      if (body.md !== undefined) {
        data.md = sanitizeMd(body.md);
      }

      const updated = await app.prisma.card.update({
        where: { cardId },
        data,
        include: cardInclude(),
      });

      return reply.send({
        card: toCardJson(updated),
      });
    }
  );

app.delete(
  "/card/:cardId",
  {
    preHandler: [requireAuth, requireMyCard(app)],
    schema: deleteCardSchema,
  },
  async (req: any, reply) => {
    const cardId = req.params.cardId as string;

    const target = await app.prisma.card.findUnique({
      where: {
        cardId,
      },
      select: {
        cardId: true,
        boardId: true,
        parentCardId: true,
      },
    });

    if (!target) {
      return reply.status(404).send({
        code: "CARD_NOT_FOUND",
        message: "card not found",
      });
    }

    await app.prisma.$transaction(async (tx) => {
      /**
       * 삭제 대상의 하위 작업들을
       * 삭제 대상의 상위 작업으로 올려준다.
       *
       * 예:
       * A > B > C 구조에서 B 삭제
       * 결과: A > C
       */
      await tx.card.updateMany({
        where: {
          parentCardId: cardId,
        },
        data: {
          parentCardId: target.parentCardId,
        },
      });

      await tx.card.delete({
        where: {
          cardId,
        },
      });
    });

    return reply.send({
      ok: true,
    });
  }
);

  app.patch(
    "/card/:cardId/move",
    {
      preHandler: [requireAuth, requireMyCard(app)],
      schema: moveCardSchema,
    },
    async (req: any, reply) => {
      const cardId = req.params.cardId as string;

      const body = req.body as {
        toColumnId: string;
        toIndex: number;
      };

      const toColumnId = String(body.toColumnId ?? "").trim();
      const toIndex = Number(body.toIndex);

      if (!toColumnId || !Number.isInteger(toIndex) || toIndex < 0) {
        return reply.status(400).send({
          code: "INVALID_MOVE",
          message: "invalid move payload",
        });
      }

      const card = await app.prisma.card.findUnique({
        where: { cardId },
        select: {
          cardId: true,
          boardId: true,
          columnId: true,
          order: true,
        },
      });

      if (!card) {
        return reply.status(404).send({
          code: "CARD_NOT_FOUND",
          message: "card not found",
        });
      }

      const toColumn = await app.prisma.column.findUnique({
        where: { columnId: toColumnId },
        select: {
          columnId: true,
          boardId: true,
        },
      });

      if (!toColumn || toColumn.boardId !== card.boardId) {
        return reply.status(400).send({
          code: "INVALID_COLUMN",
          message: "target column is invalid",
        });
      }

      const cardsInTarget = await app.prisma.card.findMany({
        where: {
          columnId: toColumnId,
          NOT: {
            cardId,
          },
        },
        orderBy: {
          order: "asc",
        },
        select: {
          cardId: true,
          order: true,
        },
      });

      const prevOrder =
        toIndex <= 0
          ? null
          : cardsInTarget[toIndex - 1]?.order ?? null;

      const nextOrder =
        toIndex >= cardsInTarget.length
          ? null
          : cardsInTarget[toIndex]?.order ?? null;

      let nextOrderValue = calcOrderForInsert(prevOrder, nextOrder);

      if (nextOrderValue === null) {
        await app.prisma.$transaction(
          cardsInTarget.map((item, index) =>
            app.prisma.card.update({
              where: {
                cardId: item.cardId,
              },
              data: {
                order: index * 1024,
              },
            })
          )
        );

        const refreshed = await app.prisma.card.findMany({
          where: {
            columnId: toColumnId,
            NOT: {
              cardId,
            },
          },
          orderBy: {
            order: "asc",
          },
          select: {
            order: true,
          },
        });

        const refreshedPrevOrder =
          toIndex <= 0
            ? null
            : refreshed[toIndex - 1]?.order ?? null;

        const refreshedNextOrder =
          toIndex >= refreshed.length
            ? null
            : refreshed[toIndex]?.order ?? null;

        nextOrderValue = calcOrderForInsert(
          refreshedPrevOrder,
          refreshedNextOrder
        );
      }

      const updated = await app.prisma.card.update({
        where: {
          cardId,
        },
        data: {
          columnId: toColumnId,
          order: nextOrderValue ?? toIndex * 1024,
        },
        select: {
          cardId: true,
          boardId: true,
          columnId: true,
          order: true,
          updatedAt: true,
        },
      });

      return reply.send({
        ok: true,
        card: {
          ...updated,
          updatedAt: iso(updated.updatedAt),
        },
      });
    }
  );
};

export default cardRoutes;