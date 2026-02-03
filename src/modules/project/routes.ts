import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import {
  listProjectsSchema,
  createProjectSchema,
  getProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
} from "./schema.js";

function iso(d: Date) {
  return d.toISOString();
}

// projectId 기준 접근 권한 체크 (팀원 or ADMIN)
async function assertProjectAccess(app: any, userId: string, projectId: string) {
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
    select: { teamId: true },
  });
  if (!project) {
    return { ok: false as const, status: 404, code: "PROJECT_NOT_FOUND" };
  }

  const member = await app.prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: project.teamId, userId } },
    select: { id: true },
  });
  if (!member) {
    return { ok: false as const, status: 403, code: "FORBIDDEN" };
  }

  return { ok: true as const };
}

const projectRoutes: FastifyPluginAsync = async (app) => {
  /**
   * 팀 프로젝트 목록
   */
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
        select: {
          projectId: true,
          teamId: true,
          code: true,
          name: true,
          price: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        projects: projects.map((p) => ({
          ...p,
          createdAt: iso(p.createdAt),
          updatedAt: iso(p.updatedAt),
        })),
      });
    }
  );

  /**
   * 프로젝트 생성 (팀원)
   */
  app.post(
    "/teams/:teamId/projects",
    {
      preHandler: [requireAuth, requireTeamMember(app, (req: any) => req.params.teamId)],
      schema: createProjectSchema,
    },
    async (req: any, reply) => {
      const teamId = req.params.teamId as string;
      const body = req.body as { code: string; name: string; price?: number };

      const code = body.code?.trim();
      const name = body.name?.trim();
      const price = Number.isInteger(body.price) && body.price! >= 0 ? body.price : 0;

      if (!code) return reply.status(400).send({ code: "CODE_REQUIRED", message: "code required" });
      if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

      try {
        const project = await app.prisma.project.create({
          data: { teamId, code, name, price },
          select: {
            projectId: true,
            teamId: true,
            code: true,
            name: true,
            price: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.code(201).send({
          project: {
            ...project,
            createdAt: iso(project.createdAt),
            updatedAt: iso(project.updatedAt),
          },
        });
      } catch {
        return reply.status(409).send({
          code: "CODE_EXISTS",
          message: "project code already exists",
        });
      }
    }
  );

  /**
   * 프로젝트 단건 조회
   */
  app.get(
    "/projects/:projectId",
    { preHandler: [requireAuth], schema: getProjectSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const projectId = req.params.projectId as string;

      const access = await assertProjectAccess(app, userId, projectId);
      if (!access.ok) {
        return reply.status(access.status).send({ code: access.code });
      }

      const project = await app.prisma.project.findUnique({
        where: { projectId },
        select: {
          projectId: true,
          teamId: true,
          code: true,
          name: true,
          price: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({
        project: {
          ...project!,
          createdAt: iso(project!.createdAt),
          updatedAt: iso(project!.updatedAt),
        },
      });
    }
  );

  /**
   * 프로젝트 수정
   */
  app.patch(
    "/projects/:projectId",
    { preHandler: [requireAuth], schema: updateProjectSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const projectId = req.params.projectId as string;
      const body = req.body as { code?: string; name?: string; price?: number };

      const access = await assertProjectAccess(app, userId, projectId);
      if (!access.ok) {
        return reply.status(access.status).send({ code: access.code });
      }

      const data: any = {};
      if (body.code?.trim()) data.code = body.code.trim();
      if (body.name?.trim()) data.name = body.name.trim();
      if (body.price !== undefined) {
        if (!Number.isInteger(body.price) || body.price < 0) {
          return reply.status(400).send({ code: "INVALID_PRICE", message: "invalid price" });
        }
        data.price = body.price;
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
      }

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
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.send({
          project: {
            ...project,
            createdAt: iso(project.createdAt),
            updatedAt: iso(project.updatedAt),
          },
        });
      } catch {
        return reply.status(409).send({
          code: "CODE_EXISTS",
          message: "project code already exists",
        });
      }
    }
  );

  /**
   * 프로젝트 삭제
   */
  app.delete(
    "/projects/:projectId",
    { preHandler: [requireAuth], schema: deleteProjectSchema },
    async (req: any, reply) => {
      const userId = req.user.sub as string;
      const projectId = req.params.projectId as string;

      const access = await assertProjectAccess(app, userId, projectId);
      if (!access.ok) {
        return reply.status(access.status).send({ code: access.code });
      }

      await app.prisma.project.delete({ where: { projectId } });
      return reply.send({ ok: true });
    }
  );
};

export default projectRoutes;
