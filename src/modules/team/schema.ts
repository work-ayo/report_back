export const joinTeamSchema = {
  tags: ["team"],
  summary: "팀 참가 (joinCode)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["joinCode"],
    additionalProperties: false,
    properties: {
      joinCode: { type: "string", minLength: 4, maxLength: 50, default: "" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "teamId"],
      properties: {
        ok: { type: "boolean" },
        teamId: { type: "string" },
      },
    },
    400: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    404: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    409: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};
