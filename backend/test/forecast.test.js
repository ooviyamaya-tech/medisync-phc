import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateForecast, seasonalMultiplier } from '../src/services/forecast.js';

test('weighted moving average favors recent consumption and predicts stock-out', () => {
  const today = new Date('2026-03-31T12:00:00.000Z');
  const consumption = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(today.getTime() - (29 - index) * 86_400_000),
    quantity_used: index < 20 ? 2 : 10,
  }));
  const result = calculateForecast({ consumption, currentStock: 100, today });
  assert.ok(result.unadjusted_average_daily_use > 6);
  assert.ok(result.days_left < 20);
  assert.ok(Number.isFinite(Date.parse(result.predicted_stockout_date)));
  assert.ok(Date.parse(result.predicted_stockout_date) > today.getTime());
  assert.ok(result.confidence >= 0.8);
});

test('seasonal multiplier is higher in the monsoon months', () => {
  assert.ok(seasonalMultiplier(new Date('2026-08-01T00:00:00.000Z')) > seasonalMultiplier(new Date('2026-02-01T00:00:00.000Z')));
});

test('recent three-day consumption spike is flagged', () => {
  const today = new Date('2026-03-31T12:00:00.000Z');
  const consumption = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(today.getTime() - (29 - index) * 86_400_000),
    quantity_used: index >= 27 ? 45 : 3,
  }));
  assert.equal(calculateForecast({ consumption, currentStock: 400, today }).unusual_consumption, true);
});