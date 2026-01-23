export const signupSchema = {
  tags: ["auth"],
  summary: "회원가입",
  body: {
    type: "object",
    required: ["username", "password", "name"],
    additionalProperties: false,
    properties: {
      username: { type: "string", minLength: 3, maxLength: 30 },
      password: { type: "string", minLength: 8, maxLength: 72 },
      name: { type: "string", minLength: 1, maxLength: 50 },
      department: { type: "string", maxLength: 100 },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            name: { type: "string" },
            department: { type: ["string", "null"] },
            globalRole: { type: "string" },
          },
          required: ["id", "username", "name", "department", "globalRole"],
        },
      },
      required: ["user"],
    },
    400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
    409: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
  },
};

export const loginSchema = {
  tags: ["auth"],
  summary: "로그인",
  body: {
    type: "object",
    required: ["username", "password"],
    additionalProperties: false,
    properties: {
      username: { type: "string" },
      password: { type: "string", minLength: 8, maxLength: 72 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            name: { type: "string" },
            department: { type: ["string", "null"] },
            globalRole: { type: "string" },
          },
          required: ["id", "username", "name", "department", "globalRole"],
        },
      },
      required: ["user"],
    },
    400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
    401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
  },
};

export const meSchema = {
  tags: ["auth"],
  summary: "내 정보",
  response: {
    200: {
      type: "object",
      properties: {
        user: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              properties: {
                id: { type: "string" },
                username: { type: "string" },
                name: { type: "string" },
                department: { type: ["string", "null"] },
                globalRole: { type: "string" },
                isActive: { type: "boolean" },
              },
              required: ["id", "username", "name", "department", "globalRole", "isActive"],
            },
          ],
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

export const logoutSchema = {
  tags: ["auth"],
  summary: "로그아웃",
  response: {
    200: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
    },
  },
};
