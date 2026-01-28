// schemas/commonResponses.ts
export const ErrorResponseSchema = {
  type: "object",
  properties: {
    code: { type: "string" },
    message: { type: "string" },
  },
  required: ["code", "message"],
} as const;

export const commonErrorResponses = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  403: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  500: ErrorResponseSchema,
} as const;
