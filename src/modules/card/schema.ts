import { commonErrorResponses } from "../../common/commonResponse.js";

const userMiniShape = {
  type: "object",
  additionalProperties: false,
  required: ["userId", "id", "name"],
  properties: {
    userId: { type: "string" },
    id: { type: "string" },
    name: { type: "string" },
    email: { type: ["string", "null"] },
  },
};

const projectMiniShape = {
  type: "object",
  additionalProperties: false,
  required: [
    "projectId",
    "teamId",
    "code",
    "name",
    "price",
    "startDate",
    "endDate",
  ],
  properties: {
    projectId: { type: "string" },
    teamId: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    price: { type: "string", pattern: "^[0-9]+$" },
    startDate: { type: ["string", "null"] },
    endDate: { type: ["string", "null"] },
    colorCode: { type: "string" },
  },
};

const parentMiniShape = {
  type: "object",
  additionalProperties: false,
  required: ["cardId", "title"],
  properties: {
    cardId: { type: "string" },
    title: { type: "string" },
  },
};

const cardShape = {
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
    "parentCardId",
    "parent",
    "assigneeUserId",
    "assignee",
    "startDate",
    "dueDate",
    "progress",
    "createdAt",
    "updatedAt",
    "contentUpdateAt",
    "md",
  ],
  properties: {
    cardId: { type: "string" },
    boardId: { type: "string" },
    columnId: { type: "string" },

    title: { type: "string" },
    content: { type: ["string", "null"] },
    order: { type: "integer" },

    projectId: { type: ["string", "null"] },
    project: {
      anyOf: [projectMiniShape, { type: "null" }],
    },

    parentCardId: {
      type: ["string", "null"],
    },

    parent: {
      anyOf: [parentMiniShape, { type: "null" }],
    },

    assigneeUserId: {
      type: ["string", "null"],
    },

    assignee: {
      anyOf: [userMiniShape, { type: "null" }],
    },

    startDate: {
      type: ["string", "null"],
    },

    dueDate: {
      type: ["string", "null"],
    },

    progress: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },

    createdByUserId: { type: "string" },

    createdBy: {
      anyOf: [userMiniShape, { type: "null" }],
    },

    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    contentUpdateAt: { type: "string" },

    md: { type: "integer" },
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
      columnId: {
        type: "string",
        minLength: 1,
        default: "",
      },

      title: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        default: "",
      },

      content: {
        type: ["string", "null"],
        default: "",
      },

      projectId: {
        type: ["string", "null"],
        default: "",
      },

      parentCardId: {
        type: ["string", "null"],
        default: "",
      },

      assigneeUserId: {
        type: ["string", "null"],
        default: "",
      },

      startDate: {
        type: ["string", "null"],
        default: "",
        description: "YYYY-MM-DD",
      },

      dueDate: {
        type: ["string", "null"],
        default: "",
        description: "YYYY-MM-DD",
      },

      progress: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        default: 0,
      },

      md: {
        type: "integer",
        minimum: 0,
        default: 0,
      },
    },
  },

  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["card"],
      properties: {
        card: cardShape,
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
      cardId: {
        type: "string",
        minLength: 1,
      },
    },
  },

  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        minLength: 1,
        maxLength: 200,
      },

      content: {
        type: ["string", "null"],
      },

      projectId: {
        type: ["string", "null"],
      },

      parentCardId: {
        type: ["string", "null"],
      },

      assigneeUserId: {
        type: ["string", "null"],
      },

      startDate: {
        type: ["string", "null"],
        description: "YYYY-MM-DD",
      },

      dueDate: {
        type: ["string", "null"],
        description: "YYYY-MM-DD",
      },

      progress: {
        type: "integer",
        minimum: 0,
        maximum: 100,
      },

      md: {
        type: "integer",
        minimum: 0,
      },
    },
  },

  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["card"],
      properties: {
        card: cardShape,
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
    additionalProperties: false,
    required: ["cardId"],
    properties: {
      cardId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { type: "boolean" },
      },
    },
    ...commonErrorResponses,
  },
};

export const moveCardSchema = {
  tags: ["card"],
  summary: "카드 이동/정렬",
  security: [{ bearerAuth: [] }],

  params: {
    type: "object",
    additionalProperties: false,
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
      toColumnId: { type: "string" },
      toIndex: { type: "integer", minimum: 0 },
    },
  },

  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "card"],
      properties: {
        ok: { type: "boolean" },
        card: {
          type: "object",
          additionalProperties: false,
          required: [
            "cardId",
            "boardId",
            "columnId",
            "order",
            "updatedAt",
          ],
          properties: {
            cardId: { type: "string" },
            boardId: { type: "string" },
            columnId: { type: "string" },
            order: { type: "number" },
            updatedAt: { type: "string" },
          },
        },
      },
    },

    ...commonErrorResponses,
  },
};