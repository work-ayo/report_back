export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "Api Error";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const E = {
  badRequest: (code: string, message: string, details?: unknown) => new AppError(400, code, message, details),
  unauthorized: (code: string, message: string, details?: unknown) => new AppError(401, code, message, details),
  forbidden: (code: string, message: string, details?: unknown) => new AppError(403, code, message, details),
  notFound: (code: string, message: string, details?: unknown) => new AppError(404, code, message, details),
  conflict: (code: string, message: string, details?: unknown) => new AppError(409, code, message, details),
  internal: (code = "INTERNAL_ERROR", message = "internal server error", details?: unknown) =>
    new AppError(500, code, message, details),
};
