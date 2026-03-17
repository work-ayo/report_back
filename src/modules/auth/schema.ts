import { commonErrorResponses, errorResponseSchema } from "../../common/commonResponse.js";

const userSchema = {
  type: "object",
  additionalProperties: false,
  required: ["userId", "id", "name", "isActive"],
  properties: {
    userId: { type: "string" },
    id: { type: "string" },
    name: { type: "string" },
    isActive: { type: "boolean" },
    createdAt:{type:"string"},
    globalRole:{type:"string", default:""},
    department:{type:"string", default:""},

  },
} as const;

export const signupSchema = {
  tags: ["auth"],
  summary: "회원가입",
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    required: ["id", "password", "name"],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 3, maxLength: 50, default: "" },
      password: { type: "string", minLength: 8, maxLength: 72, default: "" },
      name: { type: "string", minLength: 1, maxLength: 100, default: "" },
          globalRole:{type:"string", default:""},
    department:{type:"string", default:""},
    },
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["accessToken", "user"],
      properties: {
        accessToken: { type: "string" },
        user: userSchema,
      },
    },
    ...commonErrorResponses,
  },
} as const;

export const loginSchema = {
  tags: ["auth"],
  summary: "로그인",
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    required: ["id", "password"],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1, maxLength: 50, default: "" },
      password: { type: "string", minLength: 8, maxLength: 72, default: "" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["accessToken", "user"],
      properties: {
        accessToken: { type: "string" },
        user: userSchema,
      },
    },

    ...commonErrorResponses,

    // 로그인 실패는 코드 "1"로 통일 (routes.ts도 같이 맞춤)
    401: {
      ...errorResponseSchema,
      properties: {
        ...errorResponseSchema.properties,
        code: { type: "string", enum: ["1"] },
      },
    },
  },
} as const;

export const meSchema = {
  tags: ["auth"],
  summary: "내 정보",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["user"],
      properties: {
        user: userSchema,
      },
    },
    ...commonErrorResponses,
  },
} as const;

export const patchMeSchema = {
  tags: ["auth"],
  summary: "내 정보 변경 (이름/비밀번호)",
  security: [{ bearerAuth: [] }],
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", maxLength: 100, default: "" },
    password: { type: "string", maxLength: 72, default: "" },
    newPassword: { type: "string", maxLength: 72, default: "" },
    globalRole:{type:"string", default:""},
    department:{type:"string", default:""},
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
    ...commonErrorResponses,
  },
} as const;

export const refreshSchema = {
  tags: ["auth"],
  summary: "Access token 재발급",
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["accessToken"],
      properties: {
        accessToken: { type: "string" },
      },
    },
  },
};

export const logoutSchema = {
  tags: ["auth"],
  summary: "로그아웃",
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { type: "boolean" },
      },
    },
  },
};
