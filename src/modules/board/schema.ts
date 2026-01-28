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
  summary: "보드 상세 (정규화 + createdBy 포함)",
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
      additionalProperties: false,
      properties: {
        board: {
          type: "object",
          required: ["boardId", "teamId", "name", "createdByUserId", "createdAt", "updatedAt"],
          additionalProperties: false,
          properties: {
            boardId: { type: "string" },
            teamId: { type: "string" },
            name: { type: "string" },
            createdByUserId: { type: "string" }, // 보드는 그대로 유지(원하면 이것도 createdBy로 바꿀 수 있음)
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },

        columns: {
          type: "array",
          items: {
            type: "object",
            required: ["columnId", "boardId", "name", "status", "order"],
            additionalProperties: false,
            properties: {
              columnId: { type: "string" },
              boardId: { type: "string" },
              name: { type: "string" },
              status: { type: "string" }, // TODO/IN_PROGRESS/DONE/CUSTOM
              order: { type: "integer" },
            },
          },
        },

        // cardId -> card object
        cardsById: {
          type: "object",
          additionalProperties: {
            type: "object",
            required: ["cardId", "boardId", "columnId", "title", "content", "order", "createdBy", "createdAt", "updatedAt"],
            additionalProperties: false,
            properties: {
              cardId: { type: "string" },
              boardId: { type: "string" },
              columnId: { type: "string" },
              title: { type: "string" },
              content: { type: ["string", "null"] },
              order: { type: "integer" },
              createdBy: {
                type: "object",
                required: ["userId", "name"],
                additionalProperties: false,
                properties: {
                  userId: { type: "string" },
                  name: { type: "string" },
                },
              },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },

        // columnId -> [cardId...]
        cardIdsByColumnId: {
          type: "object",
          additionalProperties: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
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
  },
};
