export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: parsed.error.issues },
      });
    }
    if (source === 'query') {
      Object.defineProperty(req, 'query', { value: parsed.data, writable: true, configurable: true });
    } else {
      req[source] = parsed.data;
    }
    next();
  };
}