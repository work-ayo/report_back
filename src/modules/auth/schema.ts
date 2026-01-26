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
      required: ["user"],
    },
    401: {
      type: "object",
      properties: { user: { type: "null" } },
      required: ["user"],
    },
  },
};


