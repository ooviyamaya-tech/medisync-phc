import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true, role: true, phc_id: true } });
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User no longer exists' } });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    next();
  };
}

export function enforcePHCScope(req, res, next) {
  const requested = req.params.phc_id ?? req.query.phc_id ?? req.body?.phc_id;
  if (req.user.role !== 'DISTRICT_ADMIN' && requested && requested !== req.user.phc_id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only access your assigned PHC' } });
  }
  next();
}