import { Router } from 'express';
import { z } from 'zod';
import * as api from '../controllers/apiController.js';
import { authenticate, enforcePHCScope, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pagination } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
const querySchema = z.object({ page: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().positive().max(100).optional(), phc_id: z.string().optional() }).passthrough();
const alertQuery = querySchema.extend({ status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(), severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional() });
const dateRangeQuery = querySchema.extend({ medicine_id: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() });

router.post('/auth/login', validate(api.schemas.login), api.login);
router.get('/auth/me', authenticate, api.me);

router.get('/stock', authenticate, validate(querySchema, 'query'), enforcePHCScope, api.listStock);
router.post('/stock', authenticate, validate(api.schemas.stock), api.createStock);
router.put('/stock/:id', authenticate, validate(api.schemas.stockUpdate), api.updateStock);
router.patch('/stock/:id', authenticate, validate(api.schemas.stockUpdate), api.updateStock);
router.delete('/stock/:id', authenticate, api.deleteStock);
router.post('/stock/bulk-sync', authenticate, validate(api.schemas.bulkSync), api.bulkSync);

router.post('/consumption', authenticate, validate(api.schemas.consumption), api.addConsumption);
router.get('/consumption', authenticate, validate(dateRangeQuery, 'query'), enforcePHCScope, api.listConsumption);

router.get('/forecast/:phc_id', authenticate, api.forecastForPHC);
router.get('/forecast/:phc_id/:medicine_id', authenticate, api.forecastForPHC);

router.get('/alerts', authenticate, validate(alertQuery, 'query'), enforcePHCScope, api.listAlerts);
router.patch('/alerts/:id', authenticate, validate(api.schemas.alertUpdate), api.updateAlert);

router.get('/centres/urgency', authenticate, requireRole('DISTRICT_ADMIN'), api.urgency);
router.get('/redistribution/suggest', authenticate, validate(querySchema.extend({ medicine_id: z.string().min(1), quantity: z.coerce.number().int().nonnegative().optional() }), 'query'), api.suggestRedistribution);
router.get('/indent/suggest', authenticate, validate(querySchema, 'query'), api.suggestIndent);

router.post('/transfers', authenticate, validate(api.schemas.transfer), api.createTransfer);
router.get('/transfers', authenticate, validate(querySchema.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']).optional() }), 'query'), enforcePHCScope, api.listTransfers);
router.patch('/transfers/:id/approve', authenticate, requireRole('MEDICAL_OFFICER'), api.approveTransfer);
router.patch('/transfers/:id/reject', authenticate, requireRole('MEDICAL_OFFICER'), api.rejectTransfer);

router.get('/dashboard/pharmacist', authenticate, requireRole('PHARMACIST'), api.pharmacistDashboard);
router.get('/dashboard/medical-officer', authenticate, requireRole('MEDICAL_OFFICER'), api.medicalOfficerDashboard);
router.get('/dashboard/district-admin', authenticate, requireRole('DISTRICT_ADMIN'), api.districtAdminDashboard);

router.get('/phcs', authenticate, async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const where = req.user.role === 'DISTRICT_ADMIN' ? {} : { id: req.user.phc_id };
  const [items, total] = await Promise.all([prisma.pHC.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }), prisma.pHC.count({ where })]);
  res.json({ data: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

router.get('/medicines', authenticate, async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([prisma.medicine.findMany({ orderBy: { name: 'asc' }, skip, take: limit }), prisma.medicine.count()]);
  res.json({ data: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

export default router;