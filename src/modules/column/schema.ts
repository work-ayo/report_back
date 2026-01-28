export const createColumnSchema = {
  tags: ["column"],
  summary: "컬럼 생성",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["boardId", "name"],
    additionalProperties: false,
    properties: {
      boardId: { type: "string", default: "" },
      name: { type: "string", minLength: 1, maxLength: 60, default: "" },
      status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE", "CUSTOM"], default: "CUSTOM" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["column"],
      properties: {
        column: {
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
    },
  },
};

export const updateColumnSchema = {
  tags: ["column"],
  summary: "컬럼 이름/상태 수정",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["columnId"],
    properties: { columnId: { type: "string" } },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60, default: "" },
      status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE", "CUSTOM"], default: "CUSTOM" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["column"],
      properties: {
        column: {
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
    },
  },
};

export const deleteColumnSchema = {
  tags: ["column"],
  summary: "컬럼 삭제",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["columnId"],
    properties: { columnId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
  },
};

export const moveColumnSchema = {
  tags: ["column"],
  summary: "컬럼 이동/정렬 (order 재정렬)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["columnId"],
    properties: { columnId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["toIndex"],
    additionalProperties: false,
    properties: {
      toIndex: { type: "integer", minimum: 0, default: 0 }, // 0-based
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
  },
};
