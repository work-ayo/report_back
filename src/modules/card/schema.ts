import { describe } from "zod/v4/core";
import { commonErrorResponses } from "../../common/commonResponse.js";

const userMiniShape = {
  type: "object",
  additionalProperties: false,
  required: ["userId", "id", "name"],
  properties: {
    userId: { type: "string" },
    id: { type: "string" },
    name: { type: "string" },
  },
};

const projectMiniShape = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "teamId", "code", "name", "price", "startDate", "endDate"],
  properties: {
    projectId: { type: "string" },
    teamId: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    price: { type: "string", pattern: "^[0-9]+$" },
    startDate: { type: "string" },
    endDate: { type: "string" },
  },
};

export const createCardSchema = {
  tags: ["card"],
  summary: "카드 생성",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["columnId", "title"],
    properties: {
      columnId: { type: "string", minLength: 1, default: "" },
      title: { type: "string", minLength: 1, maxLength: 120, default: "" },
      content: { type: "string", default: "" },
      projectId: { type: "string", default: "" },
      dueDate: { type: "string", default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["card"],
      properties: {
        card: {
          type: "object",
          additionalProperties: false,
          required: [
            "cardId",
            "boardId",
            "columnId",
            "title",
            "content",
            "order",
            "createdByUserId",
            "createdBy",
            "projectId",
            "project",
            "dueDate",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            cardId: { type: "string" },
            boardId: { type: "string" },
            columnId: { type: "string" },
            title: { type: "string" },
            content: { type: ["string", "null"] },
            order: { type: "integer" },

            projectId: { type: ["string", "null"] },
            project: { anyOf: [projectMiniShape, { type: "null" }] },

            dueDate: { type: ["string", "null"] },

            createdByUserId: { type: "string" },
            createdBy: { anyOf: [userMiniShape, { type: "null" }] },

            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    ...commonErrorResponses,
  },
};


export const updateCardSchema = {
  tags: ["card"],
  summary: "카드 수정",
  security: [{ bearerAuth: [] }],

  params: {
    type: "object",
    additionalProperties: false,
    required: ["cardId"],
    properties: {
      cardId: { type: "string", minLength: 1 },
    },
  },

  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120, default: "" },
      content: { type: "string", default: "" },
      dueDate: { type: "string", default: "", description: "YYYY-MM-DD" },
      projectId: { type: "string", default: "" }, // ""이면 null로 처리하는 로직이면 OK
    },
  },

  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["card"],
      properties: {
        card: {
          type: "object",
          additionalProperties: false,
          required: ["cardId", "boardId", "columnId", "title", "order", "createdByUserId", "createdAt", "updatedAt"],
          properties: {
            cardId: { type: "string" },
            boardId: { type: "string" },
            columnId: { type: "string" },
            title: { type: "string" },
            content: { type: ["string", "null"] },

           
            dueDate: { type: "string" },

            projectId: { type: ["string", "null"] },

            project: {
              type: ["object", "null"],
              additionalProperties: false,
              required: ["projectId", "name", "price"],
              properties: {
                projectId: { type: "string" },
                name: { type: "string" },
                // BigInt는 JSON 불가 -> string digits로 내려야 안전
                price: { type: "string", pattern: "^[0-9]+$" },
              },
            },

            order: { type: "integer" },
            createdByUserId: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    ...commonErrorResponses,
  },
};

export const deleteCardSchema = {
  tags: ["card"],
  summary: "카드 삭제",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["cardId"],
    properties: {
      cardId: { type: "string" },
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

export const moveCardSchema = {
  tags: ["card"],
  summary: "카드 이동/정렬",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["cardId"],
    properties: {
      cardId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["toColumnId", "toIndex"],
    additionalProperties: false,
    properties: {
      toColumnId: { type: "string", default: "" },
      toIndex: { type: "integer", minimum: 0, default: 0 }, // 0-based index
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
