export const signupSchema = {
  tags: ["auth"],
  summary: "회원가입",
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    required: ["id", "password", "name"],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 3, maxLength: 30 ,default:""},
      password: { type: "string", minLength: 8, maxLength: 72,default:"" },
      name: { type: "string", minLength: 1, maxLength: 50 ,default:""},
      department: { type: "string", maxLength: 100,default:"" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["accessToken", "user"],
      properties: {
        accessToken: { type: "string" },
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
    400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
    409: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
  },
};

export const loginSchema = {
  tags: ["auth"],
  summary: "로그인",
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    required: ["id", "password"],
    additionalProperties: false,
    properties: {
      id: { type: "string", default: "" },
      password: { type: "string", minLength: 8, maxLength: 72, default: "" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["accessToken", "user"],
      properties: {
        accessToken: { type: "string" },
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
    400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
    401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
  },
};

export const meSchema = {
  tags: ["auth"],
  summary: "내 정보",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      required: ["user"],
      properties: {
        user: {
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
    401: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};


export const changePasswordSchema = {
  tags: ["auth"],
  summary: "내 정보 변경 (이름/비밀번호)",
  security: [{ bearerAuth: [] }],
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", maxLength: 50, default: "" },
      password: { type: "string", maxLength: 72, default: "" },     
      newPassword: { type: "string", maxLength: 72, default: "" },  
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean" } },
    },
    400: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
    401: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } }, required: ["code","message"] },
  },
};
