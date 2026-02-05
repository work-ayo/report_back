import { commonErrorResponses } from "../../common/commonResponse.js";

// 공통: price는 BigInt라 API에서는 string(digits)로 전달
const projectShape = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "teamId", "code", "name", "price", "startDate", "endDate", "createdAt", "updatedAt"],
  properties: {
    projectId: { type: "string" },
    teamId: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },

    // BigInt 직렬화 대응
    price: { type: "string", pattern: "^[0-9]+$" },
    createdByUserId: { type: ["string", "null"] },
    createdBy:{type:"string"},
    startDate: { type: "string" },
    endDate: { type: "string" },

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
    additionalProperties: false,
    required: ["teamId"],
    properties: {
      teamId: { type: "string", minLength: 1 },
      
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["projects"],
      properties: {
        projects: {
          type: "array",
          items: projectShape,
        },
      },
    },
    ...commonErrorResponses,
  },
};

export const createProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 생성 (팀원)",
  security: [{ bearerAuth: [] }],

  // 프론트에서 JSON으로 보내는 흐름이면 이 consumes는 빼는 게 안전
  // consumes: ["application/x-www-form-urlencoded"],

  params: {
    type: "object",
    additionalProperties: false,
    required: ["teamId"],
    properties: {
      teamId: { type: "string", minLength: 1 },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    required: ["code", "name"],
    properties: {
      code: { type: "string", minLength: 1, maxLength: 40 },
      name: { type: "string", minLength: 1, maxLength: 80 },

      // BigInt -> string digits
      price: { type: "string", pattern: "^[0-9]+$", default: "0" },
  
      // optional: 빈문자열 또는 YYYY-MM-DD
      startDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
      endDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
    },
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["project"],
      properties: {
        project: projectShape,
      },
    },
    ...commonErrorResponses,
  },
};

export const getProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 단건 조회",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    additionalProperties: false,
    required: ["projectId"],
    properties: {
      projectId: { type: "string", minLength: 1 },
            createdBy:{type:"string"},
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["project"],
      properties: {
        project: projectShape,
      },
    },
    ...commonErrorResponses,
  },
};

export const updateProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 수정",
  security: [{ bearerAuth: [] }],

  // 프론트 JSON 기준이면 제거 권장
  // consumes: ["application/x-www-form-urlencoded"],

  params: {
    type: "object",
    additionalProperties: false,
    required: ["projectId"],
    properties: {
      projectId: { type: "string", minLength: 1 },
    },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      code: { type: "string", maxLength: 40 },
      name: { type: "string", maxLength: 80 },

      // BigInt -> string digits
      price: { type: "string", pattern: "^[0-9]+$" },

      // optional ("" 허용)
      startDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
      endDate: { type: "string", default: "", description: "YYYY-MM-DD (optional)" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["project"],
      properties: {
        project: projectShape,
      },
    },
    ...commonErrorResponses,
  },
};

export const deleteProjectSchema = {
  tags: ["projects"],
  summary: "프로젝트 삭제",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    additionalProperties: false,
    required: ["projectId"],
    properties: {
      projectId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { type: "boolean" },
      },
    },
    ...commonErrorResponses,
  },
};
