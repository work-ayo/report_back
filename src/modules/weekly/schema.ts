import { commonErrorResponses } from "../../common/commonResponse.js";

export const getMyReportsIndexSchema = {
  tags: ["weekly"],
  summary: "내 주간보고 인덱스(기간 내 작성된 weekStart 목록)",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["teamId", "startDate", "endDate"],
    properties: {
      teamId: { type: "string", minLength: 1 },
      startDate: { type: "string", minLength: 1, description: "YYYY-MM-DD" },
      endDate: { type: "string", minLength: 1, description: "YYYY-MM-DD" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["startDate", "endDate", "weeks"],
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        weeks: { type: "array", items: { type: "string" } },
      },
    },
    ...commonErrorResponses,
  },
};

export const getMyReportOneSchema = {
  tags: ["weekly"],
  summary: "내 주간보고 단건 조회(없으면 null)",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["teamId", "weekStart"],
    properties: {
      teamId: { type: "string", minLength: 1 },
      weekStart: { type: "string", minLength: 1, description: "YYYY-MM-DD" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["report"],
      properties: {
        report: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["teamId", "userId", "weekStart", "thisWeek", "nextWeek", "issue", "solution", "updatedAt"],
              properties: {
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
    ...commonErrorResponses,
  },
};

export const upsertMyReportSchema = {
  tags: ["weekly"],
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


