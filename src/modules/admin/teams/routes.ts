import type { FastifyPluginAsync } from "fastify";
import { requireAuth, requireAdmin } from "../../../common/middleware/auth.js";
import { randomJoinCode } from "../../../common/utils.js";
import {
    adminCreateTeamSchema,
    adminDeleteTeamSchema,
    adminAddTeamMemberSchema,
    adminRemoveTeamMemberSchema,
    adminListTeamMembersSchema,
    adminListTeamsSchema,
    adminTeamWeeklyListSchema,
    adminTeamWeeklyUserOneSchema
} from "./schema.js";


const team_base = `/admin/teams`;

function parseYmdToUtcDate(ymd: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) throw new Error("INVALID_DATE");
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

function toWeekStartUtc(d: Date): Date {
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    const diffToMon = (day + 6) % 7;
    const out = new Date(d);
    out.setUTCDate(out.getUTCDate() - diffToMon);
    out.setUTCHours(0, 0, 0, 0);
    return out;
}

function toYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}



const adminTeamsRoutes: FastifyPluginAsync = async (app) => {
    const adminPreHandler = [requireAuth, requireAdmin(app)];
    // 팀 생성 (ADMIN)
    app.post(
        `${team_base}`,
        { preHandler: adminPreHandler, schema: adminCreateTeamSchema },
        async (req: any, reply) => {
            const body = req.body as { name: string };
            const name = body.name?.trim();
            if (!name) return reply.code(400).send({ code: "NAME_REQUIRED", message: "name required" });

            // joinCode 생성(충돌 시 재시도)
            let joinCode = randomJoinCode(8);
            for (let i = 0; i < 5; i++) {
                const exists = await app.prisma.team.findUnique({ where: { joinCode } });
                if (!exists) break;
                joinCode = randomJoinCode(8);
            }

            const team = await app.prisma.team.create({
                data: {
                    name,
                    joinCode,
                    createdByUserId: req.user.sub,
                },
                select: { teamId: true, name: true, joinCode: true },
            });

            return reply.code(201).send({ team });
        }
    );

    // 팀 삭제 (ADMIN)
    app.delete(
        `${team_base}/:teamId`,
        { preHandler: adminPreHandler, schema: adminDeleteTeamSchema },
        async (req: any, reply) => {
            const teamId = req.params.teamId as string;

            const team = await app.prisma.team.findUnique({
                where: { teamId },
                select: { teamId: true },
            });
            if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

            await app.prisma.team.delete({ where: { teamId } });
            return reply.send({ ok: true });
        }
    );
    // 팀에 유저 추가 (ADMIN)
    app.post(
        `${team_base}/:teamId/members`,
        { preHandler: adminPreHandler, schema: adminAddTeamMemberSchema },
        async (req: any, reply) => {
            const teamId = req.params.teamId as string;
            const body = req.body as { userId: string; role?: "MEMBER" };

            const userId = body.userId?.trim();
            if (!userId) return reply.code(400).send({ code: "USERID_REQUIRED", message: "userId required" });

            // 팀 존재 확인
            const team = await app.prisma.team.findUnique({ where: { teamId }, select: { teamId: true } });
            if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

            // 유저 존재 확인
            const user = await app.prisma.user.findUnique({ where: { userId }, select: { userId: true } });
            if (!user) return reply.code(404).send({ code: "USER_NOT_FOUND", message: "user not found" });

            // 이미 멤버면 409
            const exists = await app.prisma.teamMember.findUnique({
                where: { teamId_userId: { teamId, userId } },
                select: { id: true },
            });
            if (exists) return reply.code(409).send({ code: "ALREADY_MEMBER", message: "already a member" });

            await app.prisma.teamMember.create({
                data: {
                    teamId,
                    userId,
                    role: "MEMBER",
                },
            });

            return reply.send({ ok: true, teamId, userId });
        }
    );

    // 팀에서 유저 제거 (ADMIN)
    app.delete(
        `${team_base}/:teamId/members/:userId`,
        { preHandler: adminPreHandler, schema: adminRemoveTeamMemberSchema },
        async (req: any, reply) => {
            const teamId = req.params.teamId as string;
            const userId = req.params.userId as string;

            const member = await app.prisma.teamMember.findUnique({
                where: { teamId_userId: { teamId, userId } },
                select: { id: true },
            });
            if (!member) return reply.code(404).send({ code: "MEMBER_NOT_FOUND", message: "member not found" });

            await app.prisma.teamMember.delete({
                where: { teamId_userId: { teamId, userId } },
            });

            return reply.send({ ok: true });
        }
    );

    app.get(
        `${team_base}`,
        { preHandler: adminPreHandler, schema: adminListTeamsSchema },
        async (_req: any, reply) => {
            const teams = await app.prisma.team.findMany({
                select: { teamId: true, name: true, joinCode: true },
                orderBy: { createdAt: "asc" },
            });

            return reply.send({ teams });
        }
    );

    //팀 멤버 목록 조회
    app.get(
        `${team_base}/:teamId/members`,
        { preHandler: adminPreHandler, schema: adminListTeamMembersSchema },
        async (req: any, reply) => {
            const teamId = req.params.teamId as string;

            const team = await app.prisma.team.findUnique({
                where: { teamId },
                select: { teamId: true,name:true, joinCode:true },
            });

            
            if (!team) return reply.code(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

            const members = await app.prisma.teamMember.findMany({
                where: { teamId },
                select: {
                    role: true,
                    user: {
                        select: {
                            userId: true,
                            id: true,
                            name: true,
                            department: true,
                            globalRole: true,
                            isActive: true,
                        },
                    },
                },
                orderBy: { joinedAt: "asc" },
            });

            return reply.send({
                team,
                members: members.map((m) => ({
                    role: m.role,
                    userId: m.user.userId,
                    id: m.user.id,
                    name: m.user.name,
                    department: m.user.department,
                    globalRole: m.user.globalRole,
                    isActive: m.user.isActive,
                })),
            });
        }
    );

    // 팀의 특정 주 보고서 리스트
    app.get(
        `${team_base}/:teamId/weekly`,
        { preHandler: adminPreHandler, schema:adminTeamWeeklyListSchema },
        async (req: any, reply) => {
            const teamId = req.params.teamId as string;
            const q = req.query as { weekStart: string };

            if (!q.weekStart) {
                return reply.status(400).send({ code: "WEEKSTART_REQUIRED", message: "weekStart required" });
            }

            const ws = toWeekStartUtc(parseYmdToUtcDate(q.weekStart));

            // 팀 존재 확인
            const team = await app.prisma.team.findUnique({
                where: { teamId },
                select: { teamId: true, name: true },
            });
            if (!team) return reply.status(404).send({ code: "TEAM_NOT_FOUND", message: "team not found" });

            // 팀 멤버 전체
            const members = await app.prisma.teamMember.findMany({
                where: { teamId },
                select: {
                    userId: true,
                    user: { select: { id: true, name: true, department: true, isActive: true } },
                },
                orderBy: { joinedAt: "asc" },
            });

            // 그 주 보고서 전부
            const reports = await app.prisma.weeklyReport.findMany({
                where: { teamId, weekStart: ws },
            });

            const reportByUserId = new Map<string, any>();
            for (const r of reports) {
                reportByUserId.set(r.userId, {
                    ...r,
                    weekStart: toYmd(r.weekStart),
                    updatedAt: r.updatedAt.toISOString(),
                });
            }

            return reply.send({
                team: { teamId: team.teamId, name: team.name },
                weekStart: toYmd(ws),
                items: members.map((m) => ({
                    userId: m.userId,
                    id: m.user.id,
                    name: m.user.name,
                    department: m.user.department,
                    isActive: m.user.isActive,
                    report: reportByUserId.get(m.userId) ?? null, // 없으면 null
                })),
            });
        }
    );

    // 특정 유저의 특정 주 보고서 단건
    app.get(
        `${team_base}/:teamId/weekly/user/:userId`,
        { preHandler: adminPreHandler , schema:adminTeamWeeklyUserOneSchema},
        async (req: any, reply) => {
            const teamId = req.params.teamId as string;
            const userId = req.params.userId as string;
            const q = req.query as { weekStart: string };

            if (!q.weekStart) {
                return reply.status(400).send({ code: "WEEKSTART_REQUIRED", message: "weekStart required" });
            }

            const ws = toWeekStartUtc(parseYmdToUtcDate(q.weekStart));

            // 팀 멤버인지 확인
            const member = await app.prisma.teamMember.findUnique({
                where: { teamId_userId: { teamId, userId } },
                select: { id: true },
            });
            if (!member) return reply.status(404).send({ code: "MEMBER_NOT_FOUND", message: "member not found" });

            const report = await app.prisma.weeklyReport.findUnique({
                where: { teamId_userId_weekStart: { teamId, userId, weekStart: ws } },
            });

            return reply.send({
                teamId,
                userId,
                weekStart: toYmd(ws),
                report: report
                    ? { ...report, weekStart: toYmd(report.weekStart), updatedAt: report.updatedAt.toISOString() }
                    : null,
            });
        }
    );

}

export default adminTeamsRoutes;