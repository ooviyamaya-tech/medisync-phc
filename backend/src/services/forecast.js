const MONTHLY_MULTIPLIERS = {
  1: 1.05, 2: 1.05, 3: 1.1, 4: 1.1, 5: 1.15, 6: 1.25,
  7: 1.3, 8: 1.3, 9: 1.2, 10: 1.1, 11: 1.05, 12: 1.05,
};

export function seasonalMultiplier(date = new Date()) {
  return MONTHLY_MULTIPLIERS[date.getMonth() + 1] ?? 1;
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function calculateForecast({ consumption, currentStock, today = new Date(), windowDays = 30 }) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const dailyTotals = new Map();
  for (const entry of consumption) {
    const key = dateKey(entry.date);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + entry.quantity_used);
  }

  const daily = Array.from({ length: windowDays }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() - (windowDays - index - 1));
    return { date: day, quantity: dailyTotals.get(dateKey(day)) ?? 0 };
  });
  const totalWeight = daily.reduce((sum, _, index) => sum + index + 1, 0);
  const weightedAverage = daily.reduce((sum, item, index) => sum + item.quantity * (index + 1), 0) / totalWeight;
  const multiplier = seasonalMultiplier(today);
  const averageDailyUse = weightedAverage * multiplier;
  const daysLeft = averageDailyUse > 0 ? currentStock / averageDailyUse : null;
  const predictedStockoutDate = daysLeft === null ? null : new Date(start.getTime() + daysLeft * 86_400_000);

  const previousDays = daily.slice(0, -3).map(item => item.quantity);
  const mean = previousDays.length ? previousDays.reduce((sum, value) => sum + value, 0) / previousDays.length : 0;
  const variance = previousDays.length ? previousDays.reduce((sum, value) => sum + (value - mean) ** 2, 0) / previousDays.length : 0;
  const standardDeviation = Math.sqrt(variance);
  const recentThreeDayUse = daily.slice(-3).reduce((sum, item) => sum + item.quantity, 0);
  const unusualConsumption = recentThreeDayUse / 3 > mean + standardDeviation * 2;
  const sampleDays = daily.filter(item => item.quantity > 0).length;
  const confidence = Math.round(Math.min(0.95, 0.35 + (sampleDays / windowDays) * 0.5 + (consumption.length >= 14 ? 0.1 : 0)) * 100) / 100;

  return {
    current_stock: currentStock,
    average_daily_use: Math.round(averageDailyUse * 100) / 100,
    unadjusted_average_daily_use: Math.round(weightedAverage * 100) / 100,
    seasonal_multiplier: multiplier,
    days_left: daysLeft === null ? null : Math.round(daysLeft * 100) / 100,
    predicted_stockout_date: predictedStockoutDate?.toISOString() ?? null,
    confidence,
    unusual_consumption: unusualConsumption,
    recent_three_day_use: recentThreeDayUse,
    recent_three_day_average: Math.round((recentThreeDayUse / 3) * 100) / 100,
    historical_mean_daily_use: Math.round(mean * 100) / 100,
    historical_stddev: Math.round(standardDeviation * 100) / 100,
    window_days: windowDays,
  };
}