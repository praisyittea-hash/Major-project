export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Endpoint not found'));
}
export function errorHandler(error, _req, res, _next) {
  const status =
    error.status ||
    (error.code === 11000
      ? 409
      : ['ValidationError', 'CastError'].includes(error.name)
        ? 400
        : 500);
  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(error.message);
  res.status(status).json({
    message:
      status >= 500
        ? 'An unexpected error occurred'
        : error.code === 11000
          ? 'This record already exists'
          : error.message,
  });
}
