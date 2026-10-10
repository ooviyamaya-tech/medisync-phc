export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.statusCode ?? 500;
  const code = error.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  if (status === 500) console.error(error);
  res.status(status).json({ error: { code, message: status === 500 ? 'An unexpected error occurred' : error.message } });
}

export function httpError(statusCode, message, code) {
  return Object.assign(new Error(message), { statusCode, code });
}