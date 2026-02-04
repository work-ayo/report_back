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
    // teamId가 cuid라면 teamId 고정은 어렵고, unique key(name)로 찾는 방식이 안전함
    name: "테스트 팀",
  },
  project: {
    code: "P-001",
    name: "첫 프로젝트",
    price: 1200000,
    startDate: "2026-02-03",
    endDate: "2026-02-28",
  },
  board: {
    name: "메인 보드",
  },
  columns: ["할 일", "진행중", "완료"],
  cards: [
    { col: "할 일", title: "홈 대시보드 UI 만들기", content: "KPI + 프로젝트 리스트 + 디데이" },
    { col: "진행중", title: "Fastify 홈 요약 API 추가", content: "GET /home/summary" },
    { col: "완료", title: "Prisma 마이그레이션 적용", content: "migrate dev 완료" },
  ],
};

// YYYY-MM-DD -> Date
function ymdToDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
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

async function makeUniqueJoinCode(len = 8) {
  for (let i = 0; i < 10; i++) {
    const code = makeJoinCode(len);
    const exists = await prisma.team.findFirst({ where: { joinCode: code } });
    if (!exists) return code;
  }
  // 10번 실패하면 길이 늘려서 한 번 더
  return makeJoinCode(12);
}


/**
 * 1) TeamMember 같은 테이블 존재 여부
 * 2) id 필드명(teamId/boardId/columnId/cardId 등)
 * 만 맞춰주면 그대로 동작.
 */

async function ensureTeam(teamName: string, creatorUserId: string) {
  const team = await prisma.team.findFirst({ where: { name: teamName } });
  if (team) return team;

  return prisma.team.create({
    data: {
      name: teamName,
      joinCode: await makeUniqueJoinCode(8), // 너가 추가한 코드
      createdByUserId: creatorUserId,        // 반드시 user.userId 넣어야 함
    },
  });
}


async function ensureTeamMember(teamId: string, userId: string) {
  const exists = await prisma.teamMember?.findUnique?.({
    where: { teamId_userId: { teamId, userId } },
  });

  if (exists) return exists;

  if (prisma.teamMember?.create) {
    return prisma.teamMember.create({
      data: { teamId, userId, role: "MEMBER" },
    });
  }

  return null;
}

async function ensureProject(teamId: string) {
  const exists = await prisma.project.findUnique({
    where: { teamId_code: { teamId, code: TEST.project.code } },
  }).catch(() => null);

  if (exists) return exists;

  return prisma.project.create({
    data: {
      teamId,
      code: TEST.project.code,
      name: TEST.project.name,
      price: TEST.project.price,
      startDate: ymdToDate(TEST.project.startDate),
      endDate: ymdToDate(TEST.project.endDate),
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

async function ensureColumns(boardId: string) {
  // 컬럼이 이미 있으면 그대로 쓰고, 없으면 생성
  const existing = await prisma.column.findMany({ where: { boardId } });

  if (existing.length > 0) {
    // 이름 매핑이 필요하면 여기서 처리
    return existing;
  }

  const created: any[] = [];
  for (let i = 0; i < TEST.columns.length; i++) {
    const name = TEST.columns[i];
    const col = await prisma.column.create({
      data: { boardId, name, order: i + 1 },
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

    // 중복 방지: 같은 보드/컬럼/타이틀 있는지 체크
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
        // dueDate 같은 필드가 있으면 예시로 넣을 수 있음
        // dueDate: ymdToDate("2026-02-10"),
      },
    });
  }
}

function makeJoinCode(len = 8) {
  // 헷갈리는 문자(0,O / 1,I,l) 빼고 생성
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}



async function main() {
  // 1) 유저 생성
  const admin = await upsertUser(TEST.admin.id, TEST.admin.name, TEST.admin.password, "ADMIN");
  const user = await upsertUser(TEST.user.id, TEST.user.name, TEST.user.password, "USER");

  // creatorUserId에는 admin.userId (PK)!!
  const team = await ensureTeam(TEST.team.name, admin.userId);
  await ensureTeamMember(team.teamId, admin.userId);
  await ensureTeamMember(team.teamId, user.userId);

  // 3) 프로젝트 1개
  await ensureProject(team.teamId);

  // 4) 보드 1개 + 컬럼 + 카드
  const board = await ensureBoard(team.teamId, admin.userId);
  const cols = await ensureColumns(board.boardId);
  await ensureCards(board, cols, admin.userId);

  console.log("seed ok:", {
    admin: admin.userId,
    user: user.userId,
    teamId: team.teamId,
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
