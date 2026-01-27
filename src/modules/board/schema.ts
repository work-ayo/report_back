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
  },
};

export const getBoardDetailSchema = {
  tags: ["board"],
  summary: "보드 상세 (컬럼 + 카드)",
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
      required: ["board", "columns", "cards"],
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
        columns: {
          type: "array",
          items: {
            type: "object",
            required: ["columnId", "boardId", "name", "status", "order"],
            properties: {
              columnId: { type: "string" },
              boardId: { type: "string" },
              name: { type: "string" },
              status: { type: "string" },
              order: { type: "integer" },
            },
          },
        },
        cards: {
          type: "array",
          items: {
            type: "object",
            required: ["cardId", "boardId", "columnId", "title", "content", "order", "createdByUserId", "createdAt", "updatedAt"],
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
    },
  },
};

export const updateBoardSchema = {
  tags: ["board"],
  summary: "보드 수정",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["boardId"],
    properties: {
      boardId: { type: "string" },
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
    200: {
      type: "object",
      required: ["board"],
      properties: {
        board: {
          type: "object",
          required: ["boardId", "teamId", "name", "createdByUserId", "createdAt", "updatedAt"],
          properties: {
            boardId: { type: "  string" },
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
};

export const deleteBoardSchema = {
  tags: ["board"],
  summary: "보드 삭제",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["boardId"],
    properties: {
      boardId: { type: "string" },
    },
  },
  response: {
    204: {
      type: "null",
    },
  },
};      