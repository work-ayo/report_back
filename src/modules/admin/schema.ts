import { commonErrorResponses } from "../../common/commonResponse.js";

export const adminCreateUserSchema = {
  tags: ["admin"],
  summary: "유저 생성 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["id", "name"],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 3, maxLength: 30, default: "" },
      name: { type: "string", minLength: 1, maxLength: 50, default: "" },
      department: { type: "string", maxLength: 100, default: "" },
      globalRole: { type: "string", enum: ["ADMIN", "USER"], default: "USER" },
      // 비번을 특정 값으로 지정하고 싶으면 선택적으로 허용
      password: { type: "string", maxLength: 72, default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["user"],
      properties: {
        user: {
          type: "object",
          required: ["userId", "id", "name", "department", "globalRole"],
          properties: {
            userId: { type: "string" },
            id: { type: "string" },
            name: { type: "string" },
            department: { type: ["string", "null"] },
            globalRole: { type: "string" },
          },
        },
      },
    },
    ...commonErrorResponses
  },
};


export const adminSetUserRoleSchema = {
  tags: ["admin"],
  summary: "유저 권한 변경 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["globalRole"],
    additionalProperties: false,
    properties: {
      globalRole: { type: "string", enum: ["ADMIN", "USER"], default: "USER" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "user"],
      properties: {
        ok: { type: "boolean" },
        user: {
          type: "object",
          required: ["userId", "id", "name", "globalRole"],
          properties: {
            userId: { type: "string" },
            id: { type: "string" },
            name: { type: "string" },
            globalRole: { type: "string" },
          },
        },
      },
    },
 ...commonErrorResponses
  },
};

// 유저 목록 조회
export const adminListUsersSchema = {
  tags: ["admin"],
  summary: "유저 목록 조회 (ADMIN)",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      required: ["users"],
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            required: ["userId", "id", "name", "department", "globalRole", "isActive"],
            properties: {
              userId: { type: "string" },
              id: { type: "string" },
              name: { type: "string" },
              department: { type: ["string", "null"] },
              globalRole: { type: "string" },
              isActive: { type: "boolean" },
            },
          },
        },
      },
    },
     ...commonErrorResponses
  },
};

// 비밀번호 초기화
export const adminResetPasswordSchema = {
  tags: ["admin"],
  summary: "유저 비밀번호 초기화 (ADMIN)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      password: {
        type: "string",
        minLength: 8,
        maxLength: 72,
        default: "",
      },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "defaultPassword"],
      properties: {
        ok: { type: "boolean" },
        defaultPassword: { type: "string" },
      },
    },
    ...commonErrorResponses
  },
};

export const adminDeleteUserSchema = {
  tags: ["admin"],
  summary: "유저 삭제 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
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


