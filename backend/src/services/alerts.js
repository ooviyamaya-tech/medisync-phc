import { prisma } from '../lib/prisma.js';
import { calculateForecast } from './forecast.js';

async function createIfNoOpen({ phc_id, medicine_id, type, severity, message, days_left = null }) {
  const open = await prisma.alert.findFirst({ where: { phc_id, medicine_id, type, status: 'OPEN' } });
  if (open) return null;
  return prisma.alert.create({ data: { phc_id, medicine_id, type, severity, message, days_left } });
}

export async function refreshAlertsForPair(phc_id, medicine_id) {
  const [stocks, consumption, medicine, phc] = await Promise.all([
    prisma.stock.findMany({ where: { phc_id, medicine_id } }),
    prisma.consumptionLog.findMany({ where: { phc_id, medicine_id, date: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { date: 'asc' } }),
    prisma.medicine.findUnique({ where: { id: medicine_id } }),
    prisma.pHC.findUnique({ where: { id: phc_id } }),
  ]);
  if (!medicine || !phc) return;
  const currentStock = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const forecast = calculateForecast({ consumption, currentStock });

  if (forecast.days_left !== null && forecast.days_left <= 7) {
    const critical = forecast.days_left <= 3;
    await createIfNoOpen({
      phc_id, medicine_id, type: 'PREDICTED_STOCKOUT', severity: critical ? 'CRITICAL' : 'HIGH',
      days_left: forecast.days_left,
      message: `${medicine.name} at ${phc.name} is projected to run out in ${Math.max(0, Math.floor(forecast.days_left))} days.`,
    });
  }
  if (forecast.unusual_consumption) {
    await createIfNoOpen({
      phc_id, medicine_id, type: 'UNUSUAL_CONSUMPTION', severity: 'HIGH',
      message: `${medicine.name} usage has exceeded its recent baseline over the last three days.`,
    });
  }

  const now = new Date();
  for (const stock of stocks) {
    const daysToExpiry = (stock.expiry_date - now) / 86_400_000;
    if (stock.quantity > 0 && daysToExpiry <= 60) {
      await createIfNoOpen({
        phc_id, medicine_id, type: 'NEAR_EXPIRY', severity: daysToExpiry <= 30 ? 'HIGH' : 'MEDIUM',
        days_left: Math.ceil(daysToExpiry),
        message: `Batch ${stock.batch_no} of ${medicine.name} expires in ${Math.max(0, Math.ceil(daysToExpiry))} days (${stock.quantity} ${medicine.unit}).`,
      });
      break;
    }
  }
  if (currentStock === 0) {
    await createIfNoOpen({ phc_id, medicine_id, type: 'LOW_STOCK', severity: 'CRITICAL', message: `${medicine.name} is out of stock at ${phc.name}.`, days_left: 0 });
  }
}

export async function refreshAllAlerts() {
  const pairs = await prisma.stock.findMany({ distinct: ['phc_id', 'medicine_id'], select: { phc_id: true, medicine_id: true } });
  const consumedPairs = await prisma.consumptionLog.findMany({ distinct: ['phc_id', 'medicine_id'], select: { phc_id: true, medicine_id: true } });
  const seen = new Set();
  for (const pair of [...pairs, ...consumedPairs]) {
    const key = `${pair.phc_id}:${pair.medicine_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      await refreshAlertsForPair(pair.phc_id, pair.medicine_id);
    }
  }
}