export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const E = {
  badRequest: (code: string, message: string) => new AppError(400, code, message),
  unauthorized: (code: string, message: string) => new AppError(401, code, message),
  forbidden: (code: string, message: string) => new AppError(403, code, message),
  notFound: (code: string, message: string) => new AppError(404, code, message),
  conflict: (code: string, message: string) => new AppError(409, code, message),
};
