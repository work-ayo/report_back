import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import {
  listProjectsSchema,
  createProjectSchema,
  getProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
  adminListAllProjectsSchema
} from "./schema.js";

function iso(d: Date) {
  return d.toISOString();
}

async function requireProjectAccess(app: any, userId: string, projectId: string) {
  // admin bypass는 middleware에서 하기도 하지만, 여기서는 project 단건이라 직접 체크
  const me = await app.prisma.user.findUnique({
    where: { userId },
    select: { globalRole: true, isActive: true },
  });
  if (!me || !me.isActive) return { ok: false as const, status: 401, code: "UNAUTHORIZED", message: "unauthorized" };
  if (me.globalRole === "ADMIN") return { ok: true as const, teamId: null as any };

  const project = await app.prisma.project.findUnique({
    where: { projectId },
    select: { projectId: true, teamId: true },
  });
  if (!project) return { ok: false as const, status: 404, code: "PROJECT_NOT_FOUND", message: "project not found" };

  const member = await app.prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: project.teamId, userId } },
    select: { id: true },
  });
  if (!member) return { ok: false as const, status: 403, code: "FORBIDDEN", message: "forbidden" };

  return { ok: true as const, teamId: project.teamId };
}

const projectRoutes: FastifyPluginAsync = async (app) => {

  // 팀 프로젝트 목록
  app.get(
    "/teams/:teamId/projects",
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)],
      schema: listProjectsSchema,
    },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;

      const projects = await app.prisma.project.findMany({
        where: { teamId },
        select: { projectId: true, teamId: true, code: true, name: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        projects: projects.map((p: any) => ({ ...p, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) })),
      });
    }
  );

  // 프로젝트 생성
  app.post(
    "/teams/:teamId/projects",
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)],
      schema: createProjectSchema,
    },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;
      const body = req.body as { code: string; name: string };

      const code = body.code?.trim();
      const name = body.name?.trim();

      if (!code) return reply.status(400).send({ code: "CODE_REQUIRED", message: "code required" });
      if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

      try {
        const project = await app.prisma.project.create({
          data: { teamId, code, name },
          select: { projectId: true, teamId: true, code: true, name: true, createdAt: true, updatedAt: true },
        });

        return reply.code(201).send({
          project: { ...project, createdAt: iso(project.createdAt), updatedAt: iso(project.updatedAt) },
        });
      } catch (e: any) {
        // @@unique([teamId, code]) 충돌
        return reply.status(409).send({ code: "CODE_EXISTS", message: "project code already exists" });
      }
    }
  );

  // 프로젝트 단건 조회
  app.get(
    "/projects/:projectId",
    { preHandler: [requireAuth], schema: getProjectSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const projectId = req.params.projectId as string;

      const access = await requireProjectAccess(app, userId, projectId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const project = await app.prisma.project.findUnique({
        where: { projectId },
        select: { projectId: true, teamId: true, code: true, name: true, createdAt: true, updatedAt: true },
      });
      if (!project) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });

      return reply.send({
        project: { ...project, createdAt: iso(project.createdAt), updatedAt: iso(project.updatedAt) },
      });
    }
  );

  // 프로젝트 수정
  app.patch(
    "/projects/:projectId",
    { preHandler: [requireAuth], schema: updateProjectSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const projectId = req.params.projectId as string;
      const body = req.body as { code?: string; name?: string };

      const access = await requireProjectAccess(app, userId, projectId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const data: any = {};
      if (body.code !== undefined && body.code.trim().length > 0) data.code = body.code.trim();
      if (body.name !== undefined && body.name.trim().length > 0) data.name = body.name.trim();

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

      try {
        const project = await app.prisma.project.update({
          where: { projectId },
          data,
          select: { projectId: true, teamId: true, code: true, name: true, createdAt: true, updatedAt: true },
        });

        return reply.send({
          project: { ...project, createdAt: iso(project.createdAt), updatedAt: iso(project.updatedAt) },
        });
      } catch (e: any) {
        return reply.status(409).send({ code: "CODE_EXISTS", message: "project code already exists" });
      }
    }
  );

  // 프로젝트 삭제
  app.delete(
    "/projects/:projectId",
    { preHandler: [requireAuth], schema: deleteProjectSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const projectId = req.params.projectId as string;

      const access = await requireProjectAccess(app, userId, projectId);
      if (!access.ok) return reply.status(access.status).send({ code: access.code, message: access.message });

      const exists = await app.prisma.project.findUnique({ where: { projectId }, select: { projectId: true } });
      if (!exists) return reply.status(404).send({ code: "PROJECT_NOT_FOUND", message: "project not found" });

      await app.prisma.project.delete({ where: { projectId } });

      return reply.send({ ok: true });
    }
  );
};

export default projectRoutes;
