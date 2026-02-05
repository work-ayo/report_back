import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireAdmin } from "../../../common/middleware/auth.js";
import {
  adminListAllProjectsSchema,
  adminCreateProjectSchema,
  adminUpdateProjectSchema,
  adminDeleteProjectSchema,
} from "./schema.js";

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

// formbody로 오면 string일 수 있어서 안전 파싱
function parsePrice(v: any): number | null {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < 0) return null;
  return n;
}

const adminProjectRoutes: FastifyPluginAsync = async (app) => {
  const adminPre = [requireAuth, requireAdmin(app)];

  // 전체 목록
  app.get(
    "/admin/projects",
    { preHandler: adminPre, schema: adminListAllProjectsSchema },
    async (req: any, reply) => {
      const q = req.query as { teamId?: string };
      const teamId = q.teamId?.trim();

      const projects = await app.prisma.project.findMany({
        where: teamId ? { teamId } : undefined,
        select: {
          projectId: true,
          teamId: true,
          code: true,
          name: true,
          price: true,
          startDate:true,
          endDate:true,
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
      const body = req.body as { teamId: string; code: string; name: string; price?: any };
      const teamId = body.teamId?.trim() ;
      const code = body.code?.trim();
      const name = body.name?.trim();


      if (!teamId) return reply.status(400).send({ code: "TEAMID_REQUIRED", message: "teamId required" });
      if (!code) return reply.status(400).send({ code: "CODE_REQUIRED", message: "code required" });
      if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

      const price = parsePrice(body.price);
      if (price === null) return reply.status(400).send({ code: "INVALID_PRICE", message: "price must be a non-negative integer" });

      // 팀 존재 확인
      const team = await app.prisma.team.findUnique({
        where: { teamId },
        select: { teamId: true, name: true },
      });
      if (!team) return reply.status(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

      try {
        const project = await app.prisma.project.create({
          data: { teamId, code, name, price },
          select: { projectId: true, teamId: true, code: true, name: true, price: true, createdAt: true, updatedAt: true },
        });

      

        return reply.code(201).send({
          project: {
            projectId: project.projectId,
            teamId: project.teamId,
            teamName: team.name,
            code: project.code,
            name: project.name,
            startDate:iso(project.startDate),
            endDate:iso(project.endDate),
            price: project.price,
            createdAt: iso(project.createdAt),
            updatedAt: iso(project.updatedAt),
          },
        });
      } catch {
        return reply.status(409).send({ code: "CODE_EXISTS", message: "project code already exists" });
      }
    }
  );

  // 수정 (ADMIN)
  app.patch(
    "/admin/projects/:projectId",
    { preHandler: adminPre, schema: adminUpdateProjectSchema },
    async (req: any, reply) => {
      const projectId = req.params.projectId as string;
      const body = req.body as { teamId?: string; code?: string; name?: string; price?: any };

      const exists = await app.prisma.project.findUnique({
        where: { projectId },
        select: { projectId: true, teamId: true },
      });
      if (!exists) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });

      const data: any = {};
      if (body.teamId !== undefined && String(body.teamId).trim().length > 0) data.teamId = String(body.teamId).trim();
      if (body.code !== undefined && String(body.code).trim().length > 0) data.code = String(body.code).trim();
      if (body.name !== undefined && String(body.name).trim().length > 0) data.name = String(body.name).trim();
      const startDate = body.startDate;
      const endDate = body.endDate;

      if (body.price !== undefined) {
        const price = parsePrice(body.price);
        if (price === null) return reply.status(400).send({ code: "INVALID_PRICE", message: "price must be a non-negative integer" });
        data.price = price;
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

      // teamId 변경이 있으면 팀 존재 확인
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
          select: { projectId: true, teamId: true, code: true, name: true, price: true, createdAt: true, updatedAt: true ,startDate:true, endDate:true},
        });

        return reply.send({
          project: {
            projectId: project.projectId,
            teamId: project.teamId,
            teamName: team.name,
            code: project.code,
            name: project.name,
            price: project.price,
                 startDate:iso(project.startDate),
            endDate:iso(project.endDate),
            createdAt: iso(project.createdAt),
            updatedAt: iso(project.updatedAt),
          },
        });
      } catch {
        return reply.status(409).send({ code: "CODE_EXISTS", message: "project code already exists" });
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
