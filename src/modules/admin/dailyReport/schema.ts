const datePattern = "^\\d{4}-\\d{2}-\\d{2}$";

export const getAdminDailyReportOverviewSchema = {
  tags: ["admin-daily-report"],
  security: [{ bearerAuth: [] }],
  summary: "관리자 데일리 리포트 분석 조회",
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["startDate", "endDate"],
    properties: {
      startDate: {
        type: "string",
        pattern: datePattern,
      },
      endDate: {
        type: "string",
        pattern: datePattern,
      },
      teamId: {
        type: "string",
        default: "ALL",
      },
      projectId: {
        type: "string",
        default: "ALL",
      },
      keyword: {
        type: "string",
        default: "",
      },
    },
  },
};