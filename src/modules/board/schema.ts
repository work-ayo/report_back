import { commonErrorResponses } from "../../common/commonResponse.js";



const columnShape = {
  type: "object",
  required: ["columnId", "boardId", "name", "order"],
  properties: {
    columnId: { type: "string" },
    boardId: { type: "string" },
    name: { type: "string" },
    order: { type: "integer" },
  },
};

const projectShape = {
  type: ["object", "null"],
  required: ["projectId", "teamId", "code", "name", "price", "createdAt", "updatedAt"],
  properties: {
    projectId: { type: "string" },
    teamId: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    price: { type: "integer", minimum: 0 },
    // createdAt: { type: "string" },
    // updatedAt: { type: "string" },
  },
};

const createdByShape = {
  type: "object",
  required: ["userId", "name"],
  properties: {
    userId: { type: "string" },
    name: { type: "string" },
  },
};
const boardShape = {
  type: "object",
  required: ["boardId", "teamId", "name", "createdAt", "updatedAt"],
  properties: {
    boardId: { type: "string" },
    teamId: { type: "string" },
    name: { type: "string" },
      createdBy: createdByShape,
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const cardShape = {
  type: "object",
  required: [
    "cardId",
    "boardId",
    "columnId",
    "title",
    "content",
    "order",
    "dueDate",
    "createdAt",
    "updatedAt",
    "createdBy",
    "project",
  ],
  properties: {
    cardId: { type: "string" },
    boardId: { type: "string" },
    columnId: { type: "string" },
    title: { type: "string" },
    content: { type: ["string", "null"] },
    order: { type: "integer" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    createdBy: createdByShape,
   dueDate: { type: ["string", "null"],},
    // project는 nullable (card.projectId가 null일 수 있으니까)
    project: projectShape,
  },
};


export const createBoardSchema = {
  tags: ["board"],
  summary: "보드 생성",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60, default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["board"],
      properties: {
        board: {
          type: "object",
          required: ["boardId", "teamId", "name", "createdByUserId"],
          properties: {
            boardId: { type: "string" },
            teamId: { type: "string" },
            name: { type: "string" },
            createdByUserId: { type: "string" },
           
          },
        },
      },
    },
     ...commonErrorResponses
  },
};

export const listBoardsSchema = {
  tags: ["board"],
  summary: "팀 보드 목록",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["boards"],
      properties: {
        boards: {
          type: "array",
          items: {
            type: "object",
            required: ["boardId", "teamId", "name", "createdByUserId", "createdAt", "updatedAt"],
            properties: {
              boardId: { type: "string" },
              teamId: { type: "string" },
              name: { type: "string" },
              createdByUserId: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
     ...commonErrorResponses
  },
};

export const getBoardDetailSchema = {
  tags: ["board"],
  summary: "보드 상세 (컬럼 + 카드 + project)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["boardId"],
    properties: {
      boardId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["board", "columns", "cardsById", "cardIdsByColumnId"],
      properties: {
        board: boardShape,
        columns: {
          type: "array",
          items: columnShape,
        },

        // cardsById: Record<string, Card>
        cardsById: {
          type: "object",
          additionalProperties: cardShape,
        },

        // cardIdsByColumnId: Record<string, string[]>
        cardIdsByColumnId: {
          type: "object",
          additionalProperties: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
 ...commonErrorResponses
     },
};



export const updateBoardSchema = {
  tags: ["board"],
  summary: "보드 이름 수정 (작성자 또는 ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["boardId"],
    properties: { boardId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60, default: "" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["board"],
      properties: {
        board: {
          type: "object",
          required: ["boardId", "teamId", "name", "createdByUserId", "createdAt", "updatedAt"],
          properties: {
            boardId: { type: "string" },
            teamId: { type: "string" },
            name: { type: "string" },
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

export const deleteBoardSchema = {
  tags: ["board"],
  summary: "보드 삭제 (작성자 또는 ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["boardId"],
    properties: { boardId: { type: "string" } },
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
