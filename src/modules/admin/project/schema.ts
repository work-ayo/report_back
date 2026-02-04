const projectShape = {
  type: "object",
  required: ["projectId", "teamId", "teamName", "code", "name", "price", "createdAt", "updatedAt"],
  properties: {
    projectId: { type: "string" },
    teamId: { type: "string" },
    teamName: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    price: { type: "integer", minimum: 0, default: 0 },
    startDate:{type:"string"},
    endDate:{type:"string"},
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

export const adminListAllProjectsSchema = {
  tags: ["admin/projects"],
  summary: "전체 프로젝트 목록 (ADMIN)",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      teamId: { type: "string", description: "optional: 특정 팀만" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["projects"],
      properties: {
        projects: {
          type: "array",
          items: projectShape, 
        },
      },
    },
    401: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
    403: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
};

export const adminCreateProjectSchema = {
  tags: ["admin/projects"],
  summary: "프로젝트 생성 (ADMIN)",
  security: [{ bearerAuth: [] }],
  consumes: ["application/x-www-form-urlencoded"],
  body: {
    type: "object",
    required: ["teamId", "code", "name"],
    additionalProperties: false,
    properties: {
      teamId: { type: "string", default: "" },
      code: { type: "string", minLength: 1, maxLength: 40, default: "" },
      name: { type: "string", minLength: 1, maxLength: 80, default: "" },
      price: { type: "integer", minimum: 0, default: 0 },

      startDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
      endDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
    },
  },
  response: {
    201: { type: "object", required: ["project"], properties: { project: projectShape } },
    409: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
    404: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
    400: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};

export const adminUpdateProjectSchema = {
  tags: ["admin/projects"],
  summary: "프로젝트 수정 (ADMIN)",
  security: [{ bearerAuth: [] }],
  consumes: ["application/x-www-form-urlencoded"],
  params: {
    type: "object",
    required: ["projectId"],
    properties: { projectId: { type: "string" } },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      teamId: { type: "string", default: "" },
      code: { type: "string", maxLength: 40, default: "" },
      name: { type: "string", maxLength: 80, default: "" },
      price: { type: "integer", minimum: 0, default: 0 },

      startDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
      endDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
    },
  },
  response: {
    200: { type: "object", required: ["project"], properties: { project: projectShape } },
    404: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
    409: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
    400: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};

export const adminDeleteProjectSchema = {
  tags: ["admin/projects"],
  summary: "프로젝트 삭제 (ADMIN)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["projectId"],
    properties: { projectId: { type: "string" } },
  },
  response: {
    200: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } },
    404: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
};
