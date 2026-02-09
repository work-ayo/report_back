import { commonErrorResponses } from "../../common/commonResponse.js";

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
    ...commonErrorResponses
  },
};

export const getMyTeamsSchema = {
  tags: ["team"],
  summary: "내가 속한 팀 목록",
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

export const leaveMyTeamSchema = {
  description: "내가 팀에서 탈퇴",
  tags: ["team"],
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
    204: { type: "null" },
  },
};

