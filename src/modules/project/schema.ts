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
          items: {
            type: "object",
            required: ["projectId", "teamId", "code", "name", "createdAt", "updatedAt"],
            properties: {
              projectId: { type: "string" },
              teamId: { type: "string" },
              code: { type: "string" },
              name: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    401: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
    403: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};


export const listProjectsSchema = {
  tags: ["project"],
  summary: "팀 프로젝트 목록",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: { teamId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["projects"],
      properties: {
        projects: {
          type: "array",
          items: {
            type: "object",
            required: ["projectId", "teamId", "code", "name", "createdAt", "updatedAt"],
            properties: {
              projectId: { type: "string" },
              teamId: { type: "string" },
              code: { type: "string" },
              name: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const createProjectSchema = {
  tags: ["project"],
  summary: "프로젝트 생성",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["teamId"],
    properties: { teamId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["code", "name"],
    additionalProperties: false,
    properties: {
      code: { type: "string", minLength: 1, maxLength: 40, default: "" },
      name: { type: "string", minLength: 1, maxLength: 80, default: "" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["project"],
      properties: {
        project: {
          type: "object",
          required: ["projectId", "teamId", "code", "name", "createdAt", "updatedAt"],
          properties: {
            projectId: { type: "string" },
            teamId: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    409: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};

export const getProjectSchema = {
  tags: ["project"],
  summary: "프로젝트 단건 조회",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["projectId"],
    properties: { projectId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["project"],
      properties: {
        project: {
          type: "object",
          required: ["projectId", "teamId", "code", "name", "createdAt", "updatedAt"],
          properties: {
            projectId: { type: "string" },
            teamId: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    404: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};

export const updateProjectSchema = {
  tags: ["project"],
  summary: "프로젝트 수정 (code/name)",
  consumes: ["application/x-www-form-urlencoded"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["projectId"],
    properties: { projectId: { type: "string" } },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      code: { type: "string", maxLength: 40, default: "" }, // optional
      name: { type: "string", maxLength: 80, default: "" }, // optional
    },
  },
  response: {
    200: {
      type: "object",
      required: ["project"],
      properties: {
        project: {
          type: "object",
          required: ["projectId", "teamId", "code", "name", "createdAt", "updatedAt"],
          properties: {
            projectId: { type: "string" },
            teamId: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    404: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
    409: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};

export const deleteProjectSchema = {
  tags: ["project"],
  summary: "프로젝트 삭제",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["projectId"],
    properties: { projectId: { type: "string" } },
  },
  response: {
    200: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } },
    404: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  },
};
