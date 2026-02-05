import { commonErrorResponses } from "../../common/commonResponse.js";

export const createCardSchema = {
  tags: ["card"],
  summary: "카드 생성",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["columnId", "title"],
    additionalProperties: false,
    properties: {
      columnId: { type: "string", default: "" },
      title: { type: "string", minLength: 1, maxLength: 120, default: "" },
      content: { type: "string", default: "" }, // 빈 문자열 허용
      projectId:{type:"string",default:""},
      dueDate:{type:"string", default:""}
    },
  },
  response: {
    201: {
      type: "object",
      required: ["card"],
      properties: {
        card: {
          type: "object",
          required: ["cardId", "boardId", "columnId", "title", "content", "order", "createdAt", "updatedAt"],
          properties: {
            cardId: { type: "string" },
            boardId: { type: "string" },
            columnId: { type: "string" },
            title: { type: "string" },
            content: { type: ["string", "null"] },
            order: { type: "integer" },
            createdByUserId: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
     ...commonErrorResponses
  },
};

export const updateCardSchema = {
  tags: ["card"],
  summary: "카드 수정",
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
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120, default: "" },
      content: { type: "string", default: "" },
     dueDate:{type:"string", default:""}
    },
  },
  response: {
    200: {
      type: "object",
      required: ["card"],
      properties: {
        card: {
          type: "object",
          required: ["cardId", "boardId", "columnId", "title", "content", "order", "createdAt", "updatedAt"],
          properties: {
            cardId: { type: "string" },
            boardId: { type: "string" },
            columnId: { type: "string" },
            title: { type: "string" },
            content: { type: ["string", "null"] },
            dueDate:{type:"string"},
            order: { type: "integer" },
            createdByUserId: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
     ...commonErrorResponses
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
