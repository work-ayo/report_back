import { commonErrorResponses } from "../../common/commonResponse.js";

export const getMyReportsSchema = {
  tags: ["report"],
  summary: "내 주간보고 조회 (기간)",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    required: ["teamId"],
    additionalProperties: false,
    properties: {
      teamId: { type: "string" },
      startDate: { type: "string", description: "YYYY-MM-DD (optional)" },
      endDate: { type: "string", description: "YYYY-MM-DD (optional)" },
    },
  },
  response: {
    200: { type: "object", additionalProperties: true },
     ...commonErrorResponses
  },
};



export const upsertMyReportSchema = {
  tags: ["report"],
  summary: "내 주간보고 작성/수정 (upsert)",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["teamId", "weekStart", "thisWeek", "nextWeek"],
    additionalProperties: false,
    properties: {
      teamId: { type: "string",default:""},
      weekStart: { type: "string", description: "YYYY-MM-DD",default:"" },
      thisWeek: { type: "string",default:"" },
      nextWeek: { type: "string" ,default:""},
      issue: { type: ["string", "null"] ,default:""},
      solution: { type: ["string", "null"] ,default:""},
    },
  },
  response: {
    200: {
      type: "object",
      required: ["report"],
      properties: {
        report: {
          type: "object",
          required: ["reportId", "teamId", "userId", "weekStart", "thisWeek", "nextWeek", "issue", "solution", "updatedAt"],
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
      },
    },
     ...commonErrorResponses
  },
};


