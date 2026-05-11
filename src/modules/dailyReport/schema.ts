const timePattern = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
const datePattern = "^\\d{4}-\\d{2}-\\d{2}$";

export const getDailyReportEntriesSchema = {
  tags: ["daily-report"],
  security: [{ bearerAuth: [] }],
  summary: "일간 작업 기록 목록 조회",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["reportDate"],
    properties: {
      reportDate: {
        type: "string",
        pattern: datePattern,
      },
      scope: {
        type: "string",
        enum: ["me", "team"],
        default: "me",
      },
    },
  },
};

export const createDailyReportEntrySchema = {
  tags: ["daily-report"],
  security: [{ bearerAuth: [] }],
  summary: "일간 작업 기록 생성",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    required: ["reportDate", "startTime", "endTime"],
    properties: {
      reportDate: {
        type: "string",
        pattern: datePattern,
      },
      startTime: {
        type: "string",
        pattern: timePattern,
      },
      endTime: {
        type: "string",
        pattern: timePattern,
      },
      projectId: {
        type: ["string", "null"],
      },
      content: {
        type: ["string", "null"],
      },
    },
  },
};

export const updateDailyReportEntrySchema = {
  tags: ["daily-report"],
  security: [{ bearerAuth: [] }],
  summary: "일간 작업 기록 수정",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["dailyReportEntryId"],
    properties: {
      dailyReportEntryId: { type: "string" },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      reportDate: {
        type: "string",
        pattern: datePattern,
      },
      startTime: {
        type: "string",
        pattern: timePattern,
      },
      endTime: {
        type: "string",
        pattern: timePattern,
      },
      projectId: {
        type: ["string", "null"],
      },
      content: {
        type: ["string", "null"],
      },
    },
  },
};

export const deleteDailyReportEntrySchema = {
  tags: ["daily-report"],
  security: [{ bearerAuth: [] }],
  summary: "일간 작업 기록 삭제",
  params: {
    type: "object",
    additionalProperties: false,
    required: ["dailyReportEntryId"],
    properties: {
      dailyReportEntryId: { type: "string" },
    },
  },
};