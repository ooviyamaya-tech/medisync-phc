export function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? '20', 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(page, limit, total) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}