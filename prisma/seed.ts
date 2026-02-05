import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST = {
  admin: {
    id: process.env.ADMIN_ID ?? "admin",
    name: process.env.ADMIN_NAME ?? "admin",
    password: process.env.ADMIN_PASSWORD ?? "admin1234",
  },
  user: {
    id: "user",
    name: "user",
    password: "user1234",
  },
  team: {
    name: "테스트 팀",
  },
  project: {
    code: "P-001",
    name: "첫 프로젝트",
    // BigInt 정책: number로 써도 create에서 BigInt로 변환해서 넣어줄게
    price: 1200000,
    startDate: "2026-02-03",
    endDate: "2026-02-28",
  },
  board: {
    name: "메인 보드",
  },
  columns: ["TODO", "IN PROGRESS", "DONE"],
  cards: [
    { col: "TODO", title: "홈 대시보드 UI 만들기", content: "KPI + 프로젝트 리스트 + 디데이" },
    { col: "IN PROGRESS", title: "Fastify 홈 요약 API 추가", content: "GET /home/summary" },
    { col: "DONE", title: "Prisma 마이그레이션 적용", content: "migrate dev 완료" },
  ],
};

// YYYY-MM-DD -> Date
function ymdToDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function makeJoinCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function makeUniqueJoinCode(len = 8) {
  for (let i = 0; i < 10; i++) {
    const code = makeJoinCode(len);
    const exists = await prisma.team.findFirst({ where: { joinCode: code } });
    if (!exists) return code;
  }
  return makeJoinCode(12);
}

async function upsertUser(loginId: string, name: string, password: string, role: "ADMIN" | "USER") {
  const exists = await prisma.user.findUnique({ where: { id: loginId } });
  if (exists) return exists;

  const hashed = await argon2.hash(password);
  return prisma.user.create({
    data: {
      id: loginId,
      password: hashed,
      name,
      globalRole: role,
      isActive: true,
    },
  });
}

async function ensureTeam(teamName: string, creatorUserId: string) {
  const team = await prisma.team.findFirst({ where: { name: teamName } });
  if (team) return team;

  return prisma.team.create({
    data: {
      name: teamName,
      joinCode: await makeUniqueJoinCode(8),
      createdByUserId: creatorUserId,
    },
  });
}

async function ensureTeamMember(teamId: string, userId: string) {
  const exists = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (exists) return exists;

  return prisma.teamMember.create({
    data: { teamId, userId, role: "MEMBER" },
  });
}

async function ensureProject(teamId: string, createdByUserId: string) {
  const exists = await prisma.project
    .findUnique({
      where: { teamId_code: { teamId, code: TEST.project.code } },
    })
    .catch(() => null);

  if (exists) {
    // 혹시 예전 데이터에 createdByUserId가 null이면 채워넣기
    if (!exists.createdByUserId) {
      await prisma.project.update({
        where: { projectId: exists.projectId },
        data: { createdByUserId },
      });
      return prisma.project.findUnique({ where: { projectId: exists.projectId } });
    }
    return exists;
  }

  return prisma.project.create({
    data: {
      teamId,
      code: TEST.project.code,
      name: TEST.project.name,
      price: BigInt(TEST.project.price),
      startDate: ymdToDate(TEST.project.startDate),
      endDate: ymdToDate(TEST.project.endDate),
      createdByUserId, // 새로 추가된 필드 반영
    },
  });
}

async function ensureBoard(teamId: string, createdByUserId: string) {
  const exists = await prisma.board.findFirst({
    where: { teamId, name: TEST.board.name },
  });
  if (exists) return exists;

  return prisma.board.create({
    data: {
      teamId,
      name: TEST.board.name,
      createdByUserId,
    },
  });
}

async function ensureColumns(boardId: string, createdByUserId: string) {
  const existing = await prisma.column.findMany({ where: { boardId } });

  if (existing.length > 0) {
    // createdByUserId가 null이면 보정
    await Promise.all(
      existing.map((c) => {
        if (c.createdByUserId) return Promise.resolve(null);
        return prisma.column.update({
          where: { columnId: c.columnId },
          data: { createdByUserId },
        });
      })
    );
    return prisma.column.findMany({ where: { boardId } });
  }

  const created: any[] = [];
  for (let i = 0; i < TEST.columns.length; i++) {
    const name = TEST.columns[i];
    const col = await prisma.column.create({
      data: {
        boardId,
        name,
        order: i + 1,
        createdByUserId,
      },
    });
    created.push(col);
  }
  return created;
}

async function ensureCards(board: any, columns: any[], createdByUserId: string) {
  const colByName = new Map(columns.map((c) => [c.name, c]));

  for (let i = 0; i < TEST.cards.length; i++) {
    const c = TEST.cards[i];
    const col = colByName.get(c.col);
    if (!col) continue;

    const exists = await prisma.card.findFirst({
      where: { boardId: board.boardId, columnId: col.columnId, title: c.title },
    });
    if (exists) continue;

    await prisma.card.create({
      data: {
        boardId: board.boardId,
        columnId: col.columnId,
        title: c.title,
        content: c.content,
        order: i + 1,
        createdByUserId,
      },
    });
  }
}

async function main() {
  const admin = await upsertUser(TEST.admin.id, TEST.admin.name, TEST.admin.password, "ADMIN");
  const user = await upsertUser(TEST.user.id, TEST.user.name, TEST.user.password, "USER");

  const team = await ensureTeam(TEST.team.name, admin.userId);
  await ensureTeamMember(team.teamId, admin.userId);
  await ensureTeamMember(team.teamId, user.userId);

  const project = await ensureProject(team.teamId, admin.userId);

  const board = await ensureBoard(team.teamId, admin.userId);
  const cols = await ensureColumns(board.boardId, admin.userId);
  await ensureCards(board, cols, admin.userId);

  console.log("seed ok:", {
    admin: admin.userId,
    user: user.userId,
    teamId: team.teamId,
    projectId: project?.projectId,
    boardId: board.boardId,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
