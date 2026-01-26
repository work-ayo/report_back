export const getMyReportsSchema = {
  tags: ["report"],
  summary: "내 주간보고 조회",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    required: ["teamId"],
    additionalProperties: false,
    properties: {
      teamId: { type: "string" },
      weekStart: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 52, default: 8 },
      beforeWeekStart: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: true,
    },
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
  },
};


