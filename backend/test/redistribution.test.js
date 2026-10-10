import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, rankRedistributionCandidates } from '../src/services/redistribution.js';

test('haversine distance is zero for the same coordinate', () => {
  assert.equal(haversineKm({ latitude: 20, longitude: 85 }, { latitude: 20, longitude: 85 }), 0);
});

test('donors rank by distance, then surplus, then earliest expiry', () => {
  const source = { latitude: 20, longitude: 85 };
  const date = new Date('2027-01-01T00:00:00.000Z');
  const ranked = rankRedistributionCandidates({
    source,
    averageDailyDemand: 1,
    requestedQuantity: 10,
    candidates: [
      { id: 'far', name: 'Far', district: 'Khordha', latitude: 21, longitude: 85, stocks: [{ quantity: 80, expiry_date: date }] },
      { id: 'near-small', name: 'Near small', district: 'Khordha', latitude: 20.01, longitude: 85, stocks: [{ quantity: 40, expiry_date: date }] },
      { id: 'near-large', name: 'Near large', district: 'Khordha', latitude: 20.01, longitude: 85, stocks: [{ quantity: 60, expiry_date: new Date('2027-03-01T00:00:00.000Z') }] },
      { id: 'no-surplus', name: 'No surplus', district: 'Khordha', latitude: 20, longitude: 85, stocks: [{ quantity: 30, expiry_date: date }] },
    ],
  });
  assert.deepEqual(ranked.map(item => item.phc_id), ['near-large', 'near-small', 'far']);
  assert.equal(ranked[0].recommended_quantity, 10);
  assert.equal(ranked[0].latitude, 20.01);
  assert.equal(ranked[0].longitude, 85);
});