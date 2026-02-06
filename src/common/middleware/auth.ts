import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * JWT 인증 (app.decorate("authenticate") 사용)
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const app = req.server as any;
  return app.authenticate(req, reply);
}

/**
 * 공통: 활성 유저 로드 (없으면 reply 보내고 null)
 */
async function getActiveUserOrReply(app: any, req: any, reply: any) {
  const userId = req.user?.sub as string | undefined;
  if (!userId) {
    reply.status(401).send({ code: "UNAUTHORIZED", message: "unauthorized" });
    return null;
  }

  const user = await app.prisma.user.findUnique({
    where: { userId },
    select: { userId: true, globalRole: true, isActive: true },
  });

  if (!user || !user.isActive) {
    reply.status(401).send({ code: "UNAUTHORIZED", message: "unauthorized" });
    return null;
  }

  return user as { userId: string; globalRole: "ADMIN" | "USER"; isActive: boolean };
}

/**
 * 전역 ADMIN만 통과
 * - requireAuth 이후 실행 전제
 */
export function requireAdmin(app: any) {
  return async (req: any, reply: any) => {
    const user = await getActiveUserOrReply(app, req, reply);
    if (!user) return;

    if (user.globalRole !== "ADMIN") {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }
  };
}

/**
 * 팀 멤버인지 확인 (ADMIN bypass)
 * - requireAuth 이후 실행 전제
 */
export function requireTeamMember(app: any, getTeamId: (req: any) => string) {
  return async (req: any, reply: any) => {
    const user = await getActiveUserOrReply(app, req, reply);
    if (!user) return;

    const teamId = getTeamId(req);
    if (!teamId) {
      return reply.status(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });
    }

    if (user.globalRole === "ADMIN") return;

    const member = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.userId } },
      select: { id: true },
    });

    if (!member) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }
  };
}



/**
 * 내가 쓴 카드인지 확인 (ADMIN bypass)
 * - requireAuth 이후 실행 전제
 * - cardId는 기본적으로 req.params.cardId에서 읽음
 */

export function requireMyColumn(app: FastifyInstance, getColumnId: (req: any) => string = (req) => String(req.params?.columnId ?? "")) {
  return async (req: any, reply: any) => {
    const user = await getActiveUserOrReply(app, req, reply);
    if (!user) return;

    const columnId = String(getColumnId(req) ?? "").trim();
    if (!columnId) {
      return reply.status(400).send({ code: "COLUMNID_REQUIRED", message: "column required" });
    }

    // ADMIN은 bypass
    if (user.globalRole === "ADMIN") return;

    const column = await app.prisma.column.findUnique({
      where: { columnId },
      select: { columnId: true, createdBy: true },
    });

    if (!column) {
      return reply.status(404).send({ code: "COLUMN_NOT_FOUND", message: "column not found" });
    }

    if (column.createdBy.userId !== user.userId) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }
  };
}



/**
 * 내가 쓴 카드인지 확인 (ADMIN bypass)
 * - requireAuth 이후 실행 전제
 * - cardId는 기본적으로 req.params.cardId에서 읽음
 */

export function requireMyCard(app: FastifyInstance, getCardId: (req: any) => string = (req) => String(req.params?.cardId ?? "")) {
  return async (req: any, reply: any) => {
    const user = await getActiveUserOrReply(app, req, reply);
    if (!user) return;

    const cardId = String(getCardId(req) ?? "").trim();
    if (!cardId) {
      return reply.status(400).send({ code: "CARDID_REQUIRED", message: "cardId required" });
    }

    // ADMIN은 bypass
    if (user.globalRole === "ADMIN") return;

    const card = await app.prisma.card.findUnique({
      where: { cardId },
      select: { cardId: true, createdBy: true },
    });

    if (!card) {
      return reply.status(404).send({ code: "CARD_NOT_FOUND", message: "card not found" });
    }

    if (card.createdBy.userId !== user.userId) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }
  };
}

/**
 * 보드 접근 가능(팀 멤버 or ADMIN)
 * - req.params.boardId 필요
 */
export function requireBoardAccess(app: any) {
  return async (req: any, reply: any) => {
    const user = await getActiveUserOrReply(app, req, reply);
    if (!user) return;

    const boardId = req.params?.boardId as string | undefined;
    if (!boardId) {
      return reply.status(400).send({ code: "BOARDID_REQUIRED", message: "boardId required" });
    }

    if (user.globalRole === "ADMIN") return;

    const board = await app.prisma.board.findUnique({
      where: { boardId },
      select: { teamId: true },
    });
    if (!board) {
      return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });
    }

    const member = await app.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: board.teamId, userId: user.userId } },
      select: { id: true },
    });

    if (!member) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }
  };
}

/**
 * 보드 수정/삭제 권한 (보드 생성자 or ADMIN)
 * - req.params.boardId 필요
 */
export function requireBoardOwnerOrAdmin(app: any) {
  return async (req: any, reply: any) => {
    const user = await getActiveUserOrReply(app, req, reply);
    if (!user) return;

    const boardId = req.params?.boardId as string | undefined;
    if (!boardId) {
      return reply.status(400).send({ code: "BOARDID_REQUIRED", message: "boardId required" });
    }

    if (user.globalRole === "ADMIN") return;

    const board = await app.prisma.board.findUnique({
      where: { boardId },
      select: { createdByUserId: true },
    });
    if (!board) {
      return reply.status(404).send({ code: "BOARD_NOT_FOUND", message: "board not found" });
    }

    if (board.createdByUserId !== user.userId) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "forbidden" });
    }
  };
}


export async function assertTeamMemberByBoard(app: any, userId: string, boardId: string) {
  // active user + admin bypass
  const me = await app.prisma.user.findUnique({
    where: { userId },
    select: { globalRole: true, isActive: true },
  });
  if (!me || !me.isActive) {
    return { ok: false as const, status: 401, code: "UNAUTHORIZED", message: "unauthorized" };
  }
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


// projectId 수정, 삭제 접근 권한 체크
// - read/list: 팀원 or ADMIN
// - write(delete/update): 작성자 or ADMIN
export async function assertProjecPatchDeltAccess(
  app: any,
  userId: string,
  projectId: string,
) {
  const me = await app.prisma.user.findUnique({
    where: { userId },
    select: { globalRole: true, isActive: true },
  });

  if (!me || !me.isActive) {
    return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
  }
  if (me.globalRole === "ADMIN") {
    return { ok: true as const };
  }

  const project = await app.prisma.project.findUnique({
    where: { projectId },
    select: { teamId: true, createdByUserId: true },
  });

  if (!project) {
    return { ok: false as const, status: 404, code: "PROJECT_NOT_FOUND" };
  }


  if (project.createdByUserId !== userId) {
    return { ok: false as const, status: 403, code: "FORBIDDEN_MY_PROJECT_ONLY" };
  }
  return { ok: true as const };

}
