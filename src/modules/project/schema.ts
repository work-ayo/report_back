import { commonErrorResponses } from "../../common/commonResponse.js";

const projectShape = {
  type: "object",
  required: ["projectId", "teamId", "code", "name", "price", "createdAt", "updatedAt"],
  properties: {
    projectId: { type: "string" },
    teamId: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    price: { type: "integer", minimum: 0 },
    startDate:{type:"string"},
    endDate:{type:"string"},
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};


export const listProjectsSchema = {
  tags: ["projects"],
  summary: "팀 프로젝트 목록 조회",
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
      required: ["projects"],
      properties: {
        projects: {
          type: "array",
          items: projectShape,
        },
      },
    },
     ...commonErrorResponses
  },
};


export const createProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 생성 (팀원)",
  security: [{ bearerAuth: [] }],
  consumes: ["application/x-www-form-urlencoded"],
  params: {
    type: "object",
    required: ["teamId"],
    properties: {
      teamId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["code", "name"],
    additionalProperties: false,
    properties: {
      code: { type: "string", minLength: 1, maxLength: 40 },
      name: { type: "string", minLength: 1, maxLength: 80 },
      price: { type: "integer", minimum: 0, default: 0 },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["project"],
      properties: {
        project: projectShape,
      },
    },
   ...commonErrorResponses
  },
};

export const getProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 단건 조회",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["projectId"],
    properties: {
      projectId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["project"],
      properties: {
        project: projectShape,
      },
    },
     ...commonErrorResponses
   },
};


export const updateProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 수정",
  security: [{ bearerAuth: [] }],
  consumes: ["application/x-www-form-urlencoded"],
  params: {
    type: "object",
    required: ["projectId"],
    properties: {
      projectId: { type: "string" },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      code: { type: "string", maxLength: 40 },
      name: { type: "string", maxLength: 80 },
      price: { type: "integer", minimum: 0 },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["project"],
      properties: {
        project: projectShape,
      },
    },
     ...commonErrorResponses
      },
};

export const deleteProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 삭제",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["projectId"],
    properties: {
      projectId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      properties: {
        ok: { type: "boolean" },
      },
    },
     ...commonErrorResponses
   },
};
