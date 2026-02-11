import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireAdmin } from "../../../common/middleware/auth.js";
import {
  adminListAllProjectsSchema,
  adminCreateProjectSchema,
  adminUpdateProjectSchema,
  adminDeleteProjectSchema,
} from "./schema.js";

import {iso, parsePrice, parseYmdOrInvalid} from "../../../common/utils.js";
import { Prisma } from "@prisma/client";
import { AppError } from "../../../common/errors.js";


const adminProjectRoutes: FastifyPluginAsync = async (app) => {
  const adminPre = [requireAuth, requireAdmin(app)];

  // 전체 목록
  app.get(
    "/admin/projects",
    { preHandler: adminPre, schema: adminListAllProjectsSchema },
    async (req: any, reply) => {
    const q = req.query as { teamId?: string };
    const teamId = q.teamId?.trim() || undefined;

    const projects = await app.prisma.project.findMany({
      ...(teamId ? { where: { teamId } } : {}), //없으면 where 자체를 안 넣음
      select: {
        projectId: true,
        teamId: true,
        code: true,
        name: true,
        price: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        team: { select: { name: true } },
      },
      orderBy: [{ teamId: "asc" }, { createdAt: "desc" }],
    });


      return reply.send({
        projects: projects.map((p: any) => ({
          projectId: p.projectId,
          teamId: p.teamId,
          teamName: p.team.name,
          code: p.code,
          name: p.name,
          price: p.price, 
          startDate:iso(p.startDate),
          endDate: iso(p.endDate),
          createdAt: iso(p.createdAt),
          updatedAt: iso(p.updatedAt),
        })),
      });
    }
  );

  // 생성 (ADMIN)

app.post(
  "/admin/projects",
  { preHandler: adminPre, schema: adminCreateProjectSchema },
  async (req: any, reply) => {
    const body = req.body as {
      teamId: string;
      code: string;
      name: string;
      price?: any;
      startDate?: string;
      endDate?: string;
    };

    const teamId = String(body.teamId ?? "").trim();
    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!teamId) return reply.status(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });
    if (!code) return reply.status(400).send({ code: "CODE_REQUIRED", message: "code required" });
    if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

    const price = parsePrice(body.price);
    if (price === null) {
      return reply.status(400).send({ code: "INVALID_PRICE", message: "price must be a non-negative integer" });
    }

    // DB BIGINT 범위를 체크해야 함
    // signed BIGINT 최대: 9,223,372,036,854,775,807
    // 만약 DB가 BIGINT면 여기서 컷:
    const MAX_BIGINT = 9223372036854775807n;
    if (typeof price === "bigint" && price > MAX_BIGINT) {
      return reply.status(400).send({ code: "PRICE_TOO_LARGE", message: "price is too large" });
    }

    const startDate = parseYmdOrInvalid(body.startDate);
    if (startDate === "INVALID") {
      return reply.status(400).send({ code: "INVALID_START_DATE", message: "startDate must be YYYY-MM-DD" });
    }
    const endDate = parseYmdOrInvalid(body.endDate);
    if (endDate === "INVALID") {
      return reply.status(400).send({ code: "INVALID_END_DATE", message: "endDate must be YYYY-MM-DD" });
    }

    const team = await app.prisma.team.findUnique({
      where: { teamId },
      select: { teamId: true, name: true },
    });
    if (!team) return reply.status(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

    try {
      const project = await app.prisma.project.create({
        data: { teamId, code, name, price, startDate, endDate },
        select: {
          projectId: true,
          teamId: true,
          code: true,
          name: true,
          price: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(201).send({
        project: {
          projectId: project.projectId,
          teamId: project.teamId,
          teamName: team.name,
          code: project.code,
          name: project.name,
          startDate: iso(project.startDate),
          endDate: iso(project.endDate),
          price: project.price.toString(),
          createdAt: iso(project.createdAt),
          updatedAt: iso(project.updatedAt),
        },
      });
    } catch (e) {
       if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = Array.isArray((e.meta as any)?.target) ? (e.meta as any).target.join(",") : String((e.meta as any)?.target ?? "");
        if (target.includes("code")) throw new AppError(409, "CODE_EXISTS", "project code already exists");
        if (target.includes("name")) throw new AppError(409, "NAME_EXISTS", "project name already exists in this team");
        throw new AppError(409, "DUPLICATE", "duplicate project");
      }
      throw e; // 나머지는 전역으로
      }
    }
);

  // 수정 (ADMIN)
app.patch(
  "/admin/projects/:projectId",
  { preHandler: adminPre, schema: adminUpdateProjectSchema },
  async (req: any, reply) => {
    const projectId = req.params.projectId as string;
    const body = req.body as { teamId?: string; code?: string; name?: string; price?: any; startDate?: string; endDate?: string };


    const exists = await app.prisma.project.findUnique({
      where: { projectId },
      select: { projectId: true, teamId: true },
    });
    if (!exists) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });

    const data: any = {};

    if (body.teamId !== undefined && String(body.teamId).trim().length > 0) data.teamId = String(body.teamId).trim();
    if (body.code !== undefined && String(body.code).trim().length > 0) data.code = String(body.code).trim();
    if (body.name !== undefined && String(body.name).trim().length > 0) data.name = String(body.name).trim();

    if (body.price !== undefined) {
      const price = parsePrice(body.price);
      if (price === null)
        return reply.status(400).send({ code: "INVALID_PRICE", message: "price must be a non-negative integer" });
      data.price = price; // BigInt
    }

    // 날짜 업데이트 추가
    if (body.startDate !== undefined) {
      const s = String(body.startDate).trim();
      if (s === "") data.startDate = null;
      else {
        const d = parseYmdOrInvalid(s); // 아래 함수
        if (!d) return reply.status(400).send({ code: "INVALID_START_DATE", message: "startDate must be YYYY-MM-DD" });
        data.startDate = d;
      }
    }

    if (body.endDate !== undefined) {
      const s = String(body.endDate).trim();
      if (s === "") data.endDate = null;
      else {
        const d = parseYmdOrInvalid(s);
        if (!d) return reply.status(400).send({ code: "INVALID_END_DATE", message: "endDate must be YYYY-MM-DD" });
        data.endDate = d;
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
    }

    const finalTeamId = data.teamId ?? exists.teamId;

    const team = await app.prisma.team.findUnique({
      where: { teamId: finalTeamId },
      select: { name: true },
    });
    if (!team) return reply.status(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

    try {
      const project = await app.prisma.project.update({
        where: { projectId },
        data,
        select: {
          projectId: true,
          teamId: true,
          code: true,
          name: true,
          price: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({
        project: {
          projectId: project.projectId,
          teamId: project.teamId,
          teamName: team.name,
          code: project.code,
          name: project.name,
          price: project.price.toString(), //BigInt면 string
          startDate: iso(project.startDate),
          endDate: iso(project.endDate),
          createdAt: iso(project.createdAt),
          updatedAt: iso(project.updatedAt),
        },
      });
    } catch(e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = Array.isArray((e.meta as any)?.target) ? (e.meta as any).target.join(",") : String((e.meta as any)?.target ?? "");
    if (target.includes("code")) throw new AppError(409, "CODE_EXISTS", "project code already exists");
    if (target.includes("name")) throw new AppError(409, "NAME_EXISTS", "project name already exists in this team");
    throw new AppError(409, "DUPLICATE", "duplicate project");
  }
      throw e; // 나머지는 전역으로
    }
  }
);

  // 삭제 (ADMIN)
  app.delete(
    "/admin/projects/:projectId",
    { preHandler: adminPre, schema: adminDeleteProjectSchema },
    async (req: any, reply) => {
      const projectId = req.params.projectId as string;

      const exists = await app.prisma.project.findUnique({
        where: { projectId },
        select: { projectId: true },
      });
      if (!exists) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });

      await app.prisma.project.delete({ where: { projectId } });

      return reply.send({ ok: true });
    }
  );
};

export default adminProjectRoutes;
