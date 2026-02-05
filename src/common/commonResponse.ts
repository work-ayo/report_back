// schemas/commonResponses.ts
export const errorResponseSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    details: {}, // unknown 허용(문서화가 더 필요하면 구조를 명확히)
  },
} as const;

export const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
} as const;
