import type { FastifyPluginAsync } from "fastify";
import { assertProjecPatchDeltAccess, requireAuth, requireTeamMember } from "../../common/middleware/auth.js";
import {
  listProjectsSchema,
  createProjectSchema,
  getProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
} from "./schema.js";
import { iso, parsePriceBigInt, parseYmdOrInvalid } from "../../common/utils.js";

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
          createdByUserId: true,
          createdBy: { select: { userId: true, name: true, id: true } },
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        projects: projects.map((p) => ({
          ...p,
          price: p.price.toString(),
          startDate: iso(p.startDate),
          endDate: iso(p.endDate),
          createdAt: iso(p.createdAt),
          updatedAt: iso(p.updatedAt),
        }))
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
      const body = req.body as {
        code: string;
        name: string;
        price?: string;      // digits string
        startDate?: string;
        endDate?: string;
      };

      const code = String(body.code ?? "").trim();
      const name = String(body.name ?? "").trim();
      const userId = req.user.sub as string;

      if (!code) return reply.status(400).send({ code: "CODE_REQUIRED", message: "code required" });
      if (!name) return reply.status(400).send({ code: "NAME_REQUIRED", message: "name required" });

      const price = parsePriceBigInt(body.price);
      if (price === null) return reply.status(400).send({ code: "INVALID_PRICE", message: "invalid price" });

      const startDate = parseYmdOrInvalid(body.startDate);
      if (startDate === "INVALID")
        return reply.status(400).send({ code: "INVALID_START_DATE", message: "startDate must be YYYY-MM-DD" });

      const endDate = parseYmdOrInvalid(body.endDate);
      if (endDate === "INVALID")
        return reply.status(400).send({ code: "INVALID_END_DATE", message: "endDate must be YYYY-MM-DD" });

      try {
        const project = await app.prisma.project.create({
          data: { teamId, code, name, price, startDate, endDate, createdByUserId: userId },
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
            createdByUserId: true,
            createdBy: { select: { userId: true, name: true, id: true } },
          },
        });

        return reply.code(201).send({
          project: {
            ...project,
            price: project.price.toString(),
            startDate: iso(project.startDate),
            endDate: iso(project.endDate),
            createdAt: iso(project.createdAt),
            updatedAt: iso(project.updatedAt),
          },
        });
      } catch {
        return reply.status(409).send({ code: "CODE_EXISTS", message: "project code already exists" });
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
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          createdByUserId: true,
          createdBy: { select: { userId: true, name: true, id: true } },
        },

      });

      return reply.send({
        project: {
          ...project!,
          price: project!.price.toString(),
          startDate: iso(project!.startDate),
          endDate: iso(project!.endDate),
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

    const access = await assertProjecPatchDeltAccess(app, userId, projectId);
    if (!access.ok) return reply.status(access.status).send({ code: access.code });

    const body = req.body as {
      code?: string;
      name?: string;
      price?: string;
      startDate?: string;
      endDate?: string;
    };

    const data: any = {};
    if (body.code !== undefined && String(body.code).trim()) data.code = String(body.code).trim();
    if (body.name !== undefined && String(body.name).trim()) data.name = String(body.name).trim();

    if (body.price !== undefined) {
      const p = parsePriceBigInt(body.price);
      if (p === null) return reply.status(400).send({ code: "INVALID_PRICE", message: "invalid price" });
      data.price = p;
    }

    if (body.startDate !== undefined) {
      const d = parseYmdOrInvalid(body.startDate);
      if (d === "INVALID") return reply.status(400).send({ code: "INVALID_START_DATE", message: "startDate must be YYYY-MM-DD" });
      data.startDate = d;
    }

    if (body.endDate !== undefined) {
      const d = parseYmdOrInvalid(body.endDate);
      if (d === "INVALID") return reply.status(400).send({ code: "INVALID_END_DATE", message: "endDate must be YYYY-MM-DD" });
      data.endDate = d;
    }

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ code: "NO_FIELDS", message: "no fields to update" });
    }

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
        createdByUserId: true,
        createdBy: { select: { userId: true, name: true, id: true } },
      },
    });

    return reply.send({
      project: {
        ...project,
        price: project.price.toString(),
        startDate: iso(project.startDate),
        endDate: iso(project.endDate),
        createdAt: iso(project.createdAt),
        updatedAt: iso(project.updatedAt),
      },
    });
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

    const access = await assertProjecPatchDeltAccess(app, userId, projectId);
    if (!access.ok) return reply.status(access.status).send({ code: access.code });

    await app.prisma.project.delete({ where: { projectId } });
    return reply.send({ ok: true });
  }
);
}

export default projectRoutes;
