import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { pagination, pageMeta } from '../lib/pagination.js';
import { httpError } from '../middleware/errors.js';
import { calculateForecast, seasonalMultiplier } from '../services/forecast.js';
import { rankRedistributionCandidates } from '../services/redistribution.js';
import { refreshAlertsForPair } from '../services/alerts.js';

const id = z.string().min(1);
const positiveInteger = z.number().int().positive();
export const schemas = {
  login: z.object({ email: z.string().email(), password: z.string().min(1) }),
  stock: z.object({ phc_id: id, medicine_id: id, batch_no: z.string().min(1), quantity: z.number().int().nonnegative(), expiry_date: z.coerce.date() }),
  stockUpdate: z.object({ batch_no: z.string().min(1).optional(), quantity: z.number().int().nonnegative().optional(), expiry_date: z.coerce.date().optional() }).refine(value => Object.keys(value).length > 0),
  bulkSync: z.object({ entries: z.array(z.object({ client_id: z.string().min(1), client_timestamp: z.coerce.date(), phc_id: id, medicine_id: id, batch_no: z.string().min(1), quantity: z.number().int().nonnegative(), expiry_date: z.coerce.date() })).min(1).max(200) }),
  consumption: z.object({ phc_id: id, medicine_id: id, date: z.coerce.date().optional(), quantity_used: positiveInteger }),
  alertUpdate: z.object({ status: z.enum(['ACKNOWLEDGED', 'RESOLVED']) }),
  transfer: z.object({ from_phc_id: id.nullable().optional(), to_phc_id: id, medicine_id: id, quantity: positiveInteger, type: z.enum(['REDISTRIBUTION', 'EMERGENCY', 'DISTRICT_WAREHOUSE']), reason: z.string().min(3).max(500) }),
};

function success(res, data, status = 200) {
  return res.status(status).json({ data });
}

function requestedPhc(req) {
  return req.user.role === 'DISTRICT_ADMIN' ? req.query.phc_id : req.user.phc_id;
}

async function sumStock(phc_id, medicine_id) {
  const result = await prisma.stock.aggregate({ where: { phc_id, medicine_id }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

export async function login(req, res) {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) throw httpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: user.id, expiresIn: process.env.JWT_EXPIRES_IN ?? '12h' });
  return success(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phc_id: user.phc_id } });
}

export async function me(req, res) {
  return success(res, { user: req.user });
}

export async function listStock(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const phc_id = requestedPhc(req);
  const where = { ...(phc_id ? { phc_id } : {}), ...(req.query.medicine_id ? { medicine_id: req.query.medicine_id } : {}) };
  const [items, total] = await Promise.all([
    prisma.stock.findMany({ where, include: { phc: true, medicine: true }, orderBy: [{ expiry_date: 'asc' }, { updated_at: 'desc' }], skip, take: limit }),
    prisma.stock.count({ where }),
  ]);
  return success(res, { items, pagination: pageMeta(page, limit, total) });
}

export async function createStock(req, res) {
  if (req.user.role !== 'DISTRICT_ADMIN' && req.user.phc_id !== req.body.phc_id) throw httpError(403, 'You can only update your assigned PHC');
  const item = await prisma.stock.create({ data: req.body });
  await refreshAlertsForPair(item.phc_id, item.medicine_id);
  return success(res, item, 201);
}

export async function updateStock(req, res) {
  const existing = await prisma.stock.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Stock batch not found');
  if (req.user.role !== 'DISTRICT_ADMIN' && existing.phc_id !== req.user.phc_id) throw httpError(403, 'You can only update your assigned PHC');
  const item = await prisma.stock.update({ where: { id: existing.id }, data: req.body });
  await refreshAlertsForPair(item.phc_id, item.medicine_id);
  return success(res, item);
}

export async function deleteStock(req, res) {
  const existing = await prisma.stock.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Stock batch not found');
  if (req.user.role !== 'DISTRICT_ADMIN' && existing.phc_id !== req.user.phc_id) throw httpError(403, 'You can only update your assigned PHC');
  await prisma.stock.delete({ where: { id: existing.id } });
  await refreshAlertsForPair(existing.phc_id, existing.medicine_id);
  return success(res, { id: existing.id, deleted: true });
}

export async function bulkSync(req, res) {
  if (req.user.role !== 'DISTRICT_ADMIN' && req.body.entries.some(entry => entry.phc_id !== req.user.phc_id)) throw httpError(403, 'You can only sync your assigned PHC');
  const results = [];
  for (const entry of req.body.entries) {
    try {
      const result = await prisma.$transaction(async tx => {
        const duplicate = await tx.syncRecord.findUnique({ where: { client_id: entry.client_id } });
        if (duplicate) return { client_id: entry.client_id, success: true, duplicate: true };
        const batch = await tx.stock.findUnique({ where: { phc_id_medicine_id_batch_no: { phc_id: entry.phc_id, medicine_id: entry.medicine_id, batch_no: entry.batch_no } } });
        if (batch && entry.client_timestamp < batch.updated_at) return { client_id: entry.client_id, success: false, error: 'STALE_UPDATE', message: 'A newer stock update already exists' };
        if (batch) {
          await tx.stock.update({ where: { id: batch.id }, data: { quantity: entry.quantity, expiry_date: entry.expiry_date } });
        } else {
          await tx.stock.create({ data: { phc_id: entry.phc_id, medicine_id: entry.medicine_id, batch_no: entry.batch_no, quantity: entry.quantity, expiry_date: entry.expiry_date, updated_at: entry.client_timestamp } });
        }
        await tx.syncRecord.create({ data: { client_id: entry.client_id, client_time: entry.client_timestamp } });
        return { client_id: entry.client_id, success: true, duplicate: false };
      });
      results.push(result);
      if (result.success && !result.duplicate) await refreshAlertsForPair(entry.phc_id, entry.medicine_id);
    } catch (error) {
      results.push({ client_id: entry.client_id, success: false, error: 'SYNC_FAILED', message: error.code === 'P2003' ? 'Unknown PHC or medicine' : 'Unable to apply this stock update' });
    }
  }
  return success(res, { results, succeeded: results.filter(item => item.success).length, failed: results.filter(item => !item.success).length });
}

export async function addConsumption(req, res) {
  if (req.user.role !== 'DISTRICT_ADMIN' && req.body.phc_id !== req.user.phc_id) throw httpError(403, 'You can only log consumption for your assigned PHC');
  const item = await prisma.consumptionLog.create({ data: { ...req.body, date: req.body.date ?? new Date() } });
  await refreshAlertsForPair(item.phc_id, item.medicine_id);
  return success(res, item, 201);
}

export async function listConsumption(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const phc_id = requestedPhc(req);
  const where = {
    ...(phc_id ? { phc_id } : {}),
    ...(req.query.medicine_id ? { medicine_id: req.query.medicine_id } : {}),
    ...(req.query.from || req.query.to ? { date: { ...(req.query.from ? { gte: new Date(req.query.from) } : {}), ...(req.query.to ? { lte: new Date(req.query.to) } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.consumptionLog.findMany({ where, include: { medicine: true }, orderBy: { date: 'desc' }, skip, take: limit }),
    prisma.consumptionLog.count({ where }),
  ]);
  return success(res, { items, pagination: pageMeta(page, limit, total) });
}

export async function forecastForPHC(req, res) {
  const phc = await prisma.pHC.findUnique({ where: { id: req.params.phc_id } });
  if (!phc) throw httpError(404, 'PHC not found');
  if (req.user.role !== 'DISTRICT_ADMIN' && phc.id !== req.user.phc_id) throw httpError(403, 'You can only view your assigned PHC');
  const medicines = req.params.medicine_id
    ? await prisma.medicine.findMany({ where: { id: req.params.medicine_id } })
    : await prisma.medicine.findMany({ where: { OR: [{ stocks: { some: { phc_id: phc.id } } }, { consumption: { some: { phc_id: phc.id } } }] } });
  const items = await Promise.all(medicines.map(async medicine => {
    const [stocks, consumption] = await Promise.all([
      prisma.stock.findMany({ where: { phc_id: phc.id, medicine_id: medicine.id } }),
      prisma.consumptionLog.findMany({ where: { phc_id: phc.id, medicine_id: medicine.id, date: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    ]);
    return { medicine, ...calculateForecast({ consumption, currentStock: stocks.reduce((sum, stock) => sum + stock.quantity, 0) }) };
  }));
  return success(res, req.params.medicine_id ? items[0] ?? null : items);
}

export async function listAlerts(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const phc_id = requestedPhc(req);
  const where = { ...(phc_id ? { phc_id } : {}), ...(req.query.status ? { status: req.query.status } : {}), ...(req.query.severity ? { severity: req.query.severity } : {}) };
  const [items, total] = await Promise.all([
    prisma.alert.findMany({ where, include: { phc: true, medicine: true }, orderBy: [{ severity: 'asc' }, { created_at: 'desc' }], skip, take: limit }),
    prisma.alert.count({ where }),
  ]);
  return success(res, { items, pagination: pageMeta(page, limit, total) });
}

export async function updateAlert(req, res) {
  const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
  if (!alert) throw httpError(404, 'Alert not found');
  if (req.user.role !== 'DISTRICT_ADMIN' && alert.phc_id !== req.user.phc_id) throw httpError(403, 'You can only update alerts for your assigned PHC');
  return success(res, await prisma.alert.update({ where: { id: alert.id }, data: { status: req.body.status } }));
}

export async function urgency(req, res) {
  if (req.user.role !== 'DISTRICT_ADMIN') throw httpError(403, 'District administrator role required');
  const phcs = await prisma.pHC.findMany({ include: { stocks: true, consumption: { where: { date: { gte: new Date(Date.now() - 30 * 86_400_000) } } } } });
  const medicines = await prisma.medicine.findMany({ where: { is_essential: true } });
  const centres = phcs.map(phc => {
    const needs = medicines.flatMap(medicine => {
      const currentStock = phc.stocks.filter(stock => stock.medicine_id === medicine.id).reduce((sum, stock) => sum + stock.quantity, 0);
      const forecast = calculateForecast({ consumption: phc.consumption.filter(item => item.medicine_id === medicine.id), currentStock });
      if (forecast.days_left === null || forecast.days_left > 30) return [];
      const urgencyScore = Math.max(0, Math.round((31 - forecast.days_left) * 10 + (currentStock === 0 ? 100 : 0)));
      return [{ medicine_id: medicine.id, medicine: medicine.name, current_stock: currentStock, days_left: forecast.days_left, urgency: forecast.days_left <= 3 ? 'CRITICAL' : forecast.days_left <= 7 ? 'HIGH' : forecast.days_left <= 14 ? 'MEDIUM' : 'LOW', urgency_score: urgencyScore }];
    }).sort((a, b) => b.urgency_score - a.urgency_score);
    return { phc_id: phc.id, phc: phc.name, district: phc.district, medicines: needs, urgency_score: needs[0]?.urgency_score ?? 0 };
  });
  return success(res, centres.filter(item => item.medicines.length).sort((a, b) => b.urgency_score - a.urgency_score));
}

export async function suggestRedistribution(req, res) {
  const phc_id = req.query.phc_id ?? req.user.phc_id;
  if (!phc_id) throw httpError(400, 'phc_id is required');
  if (req.user.role !== 'DISTRICT_ADMIN' && phc_id !== req.user.phc_id) throw httpError(403, 'You can only request suggestions for your assigned PHC');
  const requestedQuantity = Number(req.query.quantity ?? 0);
  const [source, medicine] = await Promise.all([
    prisma.pHC.findUnique({ where: { id: phc_id } }),
    prisma.medicine.findUnique({ where: { id: req.query.medicine_id } }),
  ]);
  if (!source || !medicine) throw httpError(404, 'PHC or medicine not found');
  const logs = await prisma.consumptionLog.findMany({ where: { medicine_id: medicine.id, date: { gte: new Date(Date.now() - 30 * 86_400_000) } } });
  const ownLogs = logs.filter(item => item.phc_id === source.id);
  const ownForecast = calculateForecast({ consumption: ownLogs, currentStock: 0 });
  const phcs = await prisma.pHC.findMany({ where: { id: { not: source.id }, district: source.district }, include: { stocks: { where: { medicine_id: medicine.id, quantity: { gt: 0 } }, orderBy: { expiry_date: 'asc' } } } });
  const candidates = phcs.map(phc => ({ ...phc, stocks: phc.stocks.map(({ batch_no, quantity, expiry_date }) => ({ batch_no, quantity, expiry_date })) }));
  const ranked = rankRedistributionCandidates({ source, candidates, averageDailyDemand: ownForecast.average_daily_use, requestedQuantity });
  const warehouse = await prisma.districtWarehouse.findUnique({ where: { district: source.district }, include: { stocks: { where: { medicine_id: medicine.id } } } });
  const warehouseStock = warehouse?.stocks[0];
  return success(res, {
    phc_id, medicine_id: medicine.id, requested_quantity: requestedQuantity,
    recommendations: ranked,
    warehouse_fallback: warehouseStock ? { warehouse_id: warehouse.id, district: warehouse.district, distance_km: Math.round((6371 * 2 * Math.asin(Math.sqrt(Math.sin(((warehouse.latitude - source.latitude) * Math.PI / 180) / 2) ** 2 + Math.cos(source.latitude * Math.PI / 180) * Math.cos(warehouse.latitude * Math.PI / 180) * Math.sin(((warehouse.longitude - source.longitude) * Math.PI / 180) / 2) ** 2))) * 10) / 10, available_stock: warehouseStock.quantity, recommended_quantity: Math.min(warehouseStock.quantity, requestedQuantity || warehouseStock.quantity), expiry_date: warehouseStock.expiry_date } : null,
  });
}

export async function suggestIndent(req, res) {
  const phc_id = req.query.phc_id ?? req.user.phc_id;
  if (!phc_id) throw httpError(400, 'phc_id is required');
  if (req.user.role !== 'DISTRICT_ADMIN' && phc_id !== req.user.phc_id) throw httpError(403, 'You can only request an indent for your assigned PHC');
  const [phc, medicines] = await Promise.all([
    prisma.pHC.findUnique({ where: { id: phc_id } }),
    prisma.medicine.findMany({ where: { is_essential: true } }),
  ]);
  if (!phc) throw httpError(404, 'PHC not found');
  const items = await Promise.all(medicines.map(async medicine => {
    const [consumption, currentStock] = await Promise.all([
      prisma.consumptionLog.findMany({ where: { phc_id, medicine_id: medicine.id, date: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      sumStock(phc_id, medicine.id),
    ]);
    const forecast = calculateForecast({ consumption, currentStock: 0 });
    const monthlyMultiplier = seasonalMultiplier();
    const forecastDemand = Math.ceil(forecast.unadjusted_average_daily_use * monthlyMultiplier * 30);
    const safetyStock = Math.ceil(forecast.unadjusted_average_daily_use * monthlyMultiplier * 7);
    return { medicine, current_stock: currentStock, forecast_30_day_demand: forecastDemand, safety_stock: safetyStock, recommended_quantity: Math.max(0, forecastDemand + safetyStock - currentStock), seasonal_multiplier: monthlyMultiplier };
  }));
  return success(res, items.filter(item => item.recommended_quantity > 0).sort((a, b) => b.recommended_quantity - a.recommended_quantity));
}

export async function createTransfer(req, res) {
  if (req.body.type === 'DISTRICT_WAREHOUSE' && req.body.from_phc_id) throw httpError(400, 'Warehouse requests must not specify from_phc_id');
  if (req.body.type !== 'DISTRICT_WAREHOUSE' && !req.body.from_phc_id) throw httpError(400, 'from_phc_id is required for PHC transfers');
  const scoped = req.body.from_phc_id ?? req.body.to_phc_id;
  if (req.user.role !== 'DISTRICT_ADMIN' && scoped !== req.user.phc_id && req.body.to_phc_id !== req.user.phc_id) throw httpError(403, 'Transfer must involve your assigned PHC');
  const item = await prisma.transferRequest.create({ data: { ...req.body, requested_by: req.user.id } });
  await prisma.auditLog.create({ data: { user_id: req.user.id, action: 'CREATED', entity: 'TransferRequest', entity_id: item.id } });
  return success(res, item, 201);
}

export async function listTransfers(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const phc_id = requestedPhc(req);
  const where = { ...(phc_id ? { OR: [{ from_phc_id: phc_id }, { to_phc_id: phc_id }] } : {}), ...(req.query.status ? { status: req.query.status } : {}) };
  const [items, total] = await Promise.all([
    prisma.transferRequest.findMany({ where, include: { from_phc: true, to_phc: true, medicine: true, requester: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } } }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.transferRequest.count({ where }),
  ]);
  return success(res, { items, pagination: pageMeta(page, limit, total) });
}

async function decideTransfer(req, approved) {
  const transfer = await prisma.transferRequest.findUnique({ where: { id: req.params.id } });
  if (!transfer) throw httpError(404, 'Transfer request not found');
  if (transfer.status !== 'PENDING') throw httpError(409, 'Transfer request is no longer pending');
  const updated = await prisma.$transaction(async tx => {
    if (approved) {
      if (transfer.type === 'DISTRICT_WAREHOUSE') {
        const district = await tx.pHC.findUnique({ where: { id: transfer.to_phc_id }, select: { district: true } });
        const warehouse = await tx.districtWarehouse.findUnique({ where: { district: district.district }, include: { stocks: { where: { medicine_id: transfer.medicine_id } } } });
        const warehouseStock = warehouse?.stocks[0];
        if (!warehouseStock || warehouseStock.quantity < transfer.quantity) throw httpError(409, 'Insufficient district warehouse stock');
        await tx.warehouseStock.update({ where: { id: warehouseStock.id }, data: { quantity: { decrement: transfer.quantity } } });
      } else {
        const batches = await tx.stock.findMany({ where: { phc_id: transfer.from_phc_id, medicine_id: transfer.medicine_id, quantity: { gt: 0 } }, orderBy: { expiry_date: 'asc' } });
        if (batches.reduce((sum, batch) => sum + batch.quantity, 0) < transfer.quantity) throw httpError(409, 'Source PHC has insufficient stock');
        let remaining = transfer.quantity;
        for (const batch of batches) {
          if (!remaining) break;
          const moved = Math.min(batch.quantity, remaining);
          await tx.stock.update({ where: { id: batch.id }, data: { quantity: { decrement: moved } } });
          await tx.stock.upsert({
            where: { phc_id_medicine_id_batch_no: { phc_id: transfer.to_phc_id, medicine_id: transfer.medicine_id, batch_no: batch.batch_no } },
            create: { phc_id: transfer.to_phc_id, medicine_id: transfer.medicine_id, batch_no: batch.batch_no, quantity: moved, expiry_date: batch.expiry_date },
            update: { quantity: { increment: moved }, expiry_date: batch.expiry_date },
          });
          remaining -= moved;
        }
      }
    }
    const decision = await tx.transferRequest.update({ where: { id: transfer.id }, data: { status: approved ? 'APPROVED' : 'REJECTED', approved_by: req.user.id, decided_at: new Date() } });
    await tx.auditLog.create({ data: { user_id: req.user.id, action: approved ? 'APPROVED' : 'REJECTED', entity: 'TransferRequest', entity_id: transfer.id } });
    return decision;
  });
  if (approved && transfer.from_phc_id) await refreshAlertsForPair(transfer.from_phc_id, transfer.medicine_id);
  if (approved) await refreshAlertsForPair(transfer.to_phc_id, transfer.medicine_id);
  return updated;
}

export async function approveTransfer(req, res) {
  return success(res, await decideTransfer(req, true));
}

export async function rejectTransfer(req, res) {
  return success(res, await decideTransfer(req, false));
}

async function dashboardData(phc_id) {
  const [stock, alerts, pendingTransfers, forecasts] = await Promise.all([
    prisma.stock.findMany({ where: phc_id ? { phc_id } : {}, include: { medicine: true, phc: true } }),
    prisma.alert.findMany({ where: { status: 'OPEN', ...(phc_id ? { phc_id } : {}) }, include: { medicine: true, phc: true } }),
    prisma.transferRequest.count({ where: { status: 'PENDING', ...(phc_id ? { OR: [{ from_phc_id: phc_id }, { to_phc_id: phc_id }] } : {}) } }),
    prisma.pHC.findMany({ ...(phc_id ? { where: { id: phc_id } } : {}), include: { stocks: true, consumption: { where: { date: { gte: new Date(Date.now() - 30 * 86_400_000) } } } } }),
  ]);
  const health = { healthy: 0, low: 0, critical: 0, out_of_stock: 0 };
  const risk = [];
  for (const phc of forecasts) {
    const medicineIds = new Set([...phc.stocks.map(item => item.medicine_id), ...phc.consumption.map(item => item.medicine_id)]);
    for (const medicine_id of medicineIds) {
      const currentStock = phc.stocks.filter(item => item.medicine_id === medicine_id).reduce((sum, item) => sum + item.quantity, 0);
      const forecast = calculateForecast({ consumption: phc.consumption.filter(item => item.medicine_id === medicine_id), currentStock });
      if (currentStock === 0) health.out_of_stock += 1;
      else if (forecast.days_left !== null && forecast.days_left <= 3) health.critical += 1;
      else if (forecast.days_left !== null && forecast.days_left <= 7) health.low += 1;
      else health.healthy += 1;
      if (forecast.days_left !== null) risk.push({ phc: phc.name, phc_id: phc.id, medicine_id, medicine: stock.find(item => item.medicine_id === medicine_id)?.medicine.name, days_left: forecast.days_left, current_stock: currentStock });
    }
  }
  return { stock_health: health, open_alerts: alerts.length, alert_severity: alerts.reduce((counts, item) => ({ ...counts, [item.severity]: (counts[item.severity] ?? 0) + 1 }), {}), pending_approvals: pendingTransfers, top_at_risk_medicines: risk.sort((a, b) => (a.days_left ?? Infinity) - (b.days_left ?? Infinity)).slice(0, 10), alerts: alerts.slice(0, 10) };
}

export async function pharmacistDashboard(req, res) {
  return success(res, await dashboardData(req.user.phc_id));
}

export async function medicalOfficerDashboard(req, res) {
  return success(res, await dashboardData(req.user.role === 'DISTRICT_ADMIN' ? undefined : req.user.phc_id));
}

export async function districtAdminDashboard(req, res) {
  const [data, phcs, pending, district] = await Promise.all([
    dashboardData(),
    prisma.pHC.findMany({ include: { stocks: true, consumption: { where: { date: { gte: new Date(Date.now() - 30 * 86_400_000) } } } } }),
    prisma.transferRequest.count({ where: { status: 'PENDING' } }),
    prisma.pHC.findFirst({ select: { district: true } }),
  ]);
  const shortages = phcs.flatMap(phc => {
    const ids = new Set([...phc.stocks.map(item => item.medicine_id), ...phc.consumption.map(item => item.medicine_id)]);
    return [...ids].flatMap(medicine_id => {
      const currentStock = phc.stocks.filter(item => item.medicine_id === medicine_id).reduce((sum, item) => sum + item.quantity, 0);
      const forecast = calculateForecast({ consumption: phc.consumption.filter(item => item.medicine_id === medicine_id), currentStock });
      return forecast.days_left !== null && forecast.days_left <= 7 ? [{ phc_id: phc.id, phc: phc.name, medicine_id, days_left: forecast.days_left, current_stock: currentStock }] : [];
    });
  });
  const trendStart = new Date();
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - 6);
  const totalsByDate = new Map();
  for (const phc of phcs) {
    for (const entry of phc.consumption) {
      const day = new Date(entry.date).toISOString().slice(0, 10);
      totalsByDate.set(day, (totalsByDate.get(day) ?? 0) + entry.quantity_used);
    }
  }
  const consumption_trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { day: date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }), date: key, quantity_used: totalsByDate.get(key) ?? 0 };
  });
  return success(res, { ...data, pending_approvals: pending, consumption_trend, district_shortages: { district: district?.district ?? null, count: shortages.length, items: shortages.sort((a, b) => a.days_left - b.days_left) } });
}