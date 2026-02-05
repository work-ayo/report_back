import { commonErrorResponses } from "../../../common/commonResponse.js";


export const adminCreateTeamSchema = {
  tags: ["admin/teams"],
  summary: "팀 생성 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 50, default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["team"],
      properties: {
        team: {
          type: "object",
          required: ["teamId", "name", "joinCode"],
          properties: {
            teamId: { type: "string" },
            name: { type: "string" },
            joinCode: { type: "string" },
          },
        },
      },
    },
   ...commonErrorResponses
  },
};

export const adminDeleteTeamSchema = {
  tags: ["admin/teams"],
  summary: "팀 삭제 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
    ...commonErrorResponses
  },
};

export const adminAddTeamMemberSchema = {
  tags: ["admin/teams"],
  summary: "팀에 유저 추가 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: { teamId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["userId"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", default: "" },
      role: { type: "string", enum: ["MEMBER"], default: "MEMBER" }, // 지금은 MEMBER만
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "teamId", "userId"],
      properties: {
        ok: { type: "boolean" },
        teamId: { type: "string" },
        userId: { type: "string" },
      },
    },
     ...commonErrorResponses
  },
};

export const adminRemoveTeamMemberSchema = {
  tags: ["admin/teams"],
  summary: "팀에서 탈퇴 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId", "userId"],
    properties: {
      teamId: { type: "string" },
      userId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
   ...commonErrorResponses
  },
};


export const adminListTeamsSchema = {
  tags: ["admin/teams"],
  summary: "팀 목록 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      required: ["teams"],
      properties: {
        teams: {
          type: "array",
          items: {
            type: "object",
            required: ["teamId", "name", "joinCode"],
            properties: {
              teamId: { type: "string" },
              name: { type: "string" },
              joinCode: { type: "string" },
            },
          },
        },
      },
    },
     ...commonErrorResponses
  },
};

export const adminListTeamMembersSchema = {
  tags: ["admin/teams"],
  summary: "팀 멤버 목록 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: { teamId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["members"],
      properties: {
        team:{
            type: "object",
            required: ["teamId", "name", "joinCode"],
            properties: {
              teamId: { type: "string" },
              name: { type: "string" },
              joinCode: { type: "string" },
            },
        },
        members: {
          type: "array",
          items: {
            type: "object",
            required: ["userId", "id", "name", "department", "globalRole", "role", "isActive"],
            properties: {
              userId: { type: "string" },
              id: { type: "string" },
              name: { type: "string" },
              department: { type: ["string", "null"] },
              globalRole: { type: "string" },
              role: { type: "string" }, // TeamRole
              isActive: { type: "boolean" },
            },
          },
        },
      },
    },
   ...commonErrorResponses
  },
};

export const adminTeamWeeklyListSchema = {
  tags: ["admin/teams/weekly"],
  summary: "팀 주간보고 조회 (ADMIN) - 팀원 전체 + 보고서",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  querystring: {
    type: "object",
    required: ["weekStart"],
    additionalProperties: false,
    properties: {
      weekStart: { type: "string", description: "YYYY-MM-DD" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["team", "weekStart", "items"],
      properties: {
        team: {
          type: "object",
          required: ["teamId", "name"],
          properties: {
            teamId: { type: "string" },
            name: { type: "string" },
          },
        },
        weekStart: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["userId", "id", "name", "department", "isActive", "report"],
            properties: {
              userId: { type: "string" },
              id: { type: "string" },
              name: { type: "string" },
              department: { type: ["string", "null"] },
              isActive: { type: "boolean" },
              report: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    required: [
                      "reportId",
                      "teamId",
                      "userId",
                      "weekStart",
                      "thisWeek",
                      "nextWeek",
                      "issue",
                      "solution",
                      "updatedAt",
                    ],
                    properties: {
                      reportId: { type: "string" },
                      teamId: { type: "string" },
                      userId: { type: "string" },
                      weekStart: { type: "string" },
                      thisWeek: { type: "string" },
                      nextWeek: { type: "string" },
                      issue: { type: ["string", "null"] },
                      solution: { type: ["string", "null"] },
                      updatedAt: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    ...commonErrorResponses
  },
};

export const adminTeamWeeklyUserOneSchema = {
  tags: ["admin/teams/weekly"],
  summary: "팀 내 특정 유저 주간보고 단건 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId", "userId"],
    properties: {
      teamId: { type: "string" },
      userId: { type: "string" },
    },
  },
  querystring: {
    type: "object",
    required: ["weekStart"],
    additionalProperties: false,
    properties: {
      weekStart: { type: "string", description: "YYYY-MM-DD" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["teamId", "userId", "weekStart", "report"],
      properties: {
        teamId: { type: "string" },
        userId: { type: "string" },
        weekStart: { type: "string" },
        report: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              required: [
                "reportId",
                "teamId",
                "userId",
                "weekStart",
                "thisWeek",
                "nextWeek",
                "issue",
                "solution",
                "updatedAt",
              ],
              properties: {
                reportId: { type: "string" },
                teamId: { type: "string" },
                userId: { type: "string" },
                weekStart: { type: "string" },
                thisWeek: { type: "string" },
                nextWeek: { type: "string" },
                issue: { type: ["string", "null"] },
                solution: { type: ["string", "null"] },
                updatedAt: { type: "string" },
              },
            },
          ],
        },
      },
    },
     ...commonErrorResponses
  },
};
