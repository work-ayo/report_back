export const homeSummarySchema = {
  description: "홈 대시보드 요약 데이터",
  tags: ["summary"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    additionalProperties: false,
    required: ["teamId"],
    properties: {
      teamId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["kpi", "projects", "myTasks", "deadlines", "team", "activity"],
      properties: {
        kpi: {
          type: "object",
          additionalProperties: false,
          required: ["activeProjects", "dueSoonProjects", "thisWeekDoneCards", "openIssues", "thisMonthAmount"],
          properties: {
            activeProjects: { type: "integer", minimum: 0 },
            dueSoonProjects: { type: "integer", minimum: 0 },
            thisWeekDoneCards: { type: "integer", minimum: 0 },
            openIssues: { type: "integer", minimum: 0 },
            thisMonthAmount: {
              type: "object",
              additionalProperties: false,
              required: ["currency", "amount"],
              properties: {
                currency: { type: "string", enum: ["KRW", "NOK", "USD"] },
                amount: { type: "integer" },
              },
            },
          },
        },
        projects: { type: "array" },
        myTasks: { type: "array" },
        deadlines: { type: "array" },
        team: { type: "array" },
        activity: { type: "array" },
      },
    },
    400: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
    401: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
    403: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
} as const;
