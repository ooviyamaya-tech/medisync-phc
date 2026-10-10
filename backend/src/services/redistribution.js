export function haversineKm(from, to) {
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function rankRedistributionCandidates({ source, candidates, averageDailyDemand, requestedQuantity = 0 }) {
  const reserve = Math.ceil(averageDailyDemand * 30);
  return candidates.map(candidate => {
    const available = candidate.stocks.reduce((sum, stock) => sum + stock.quantity, 0);
    const surplus = Math.max(0, available - reserve);
    const nearestExpiry = candidate.stocks
      .filter(stock => stock.quantity > 0)
      .reduce((nearest, stock) => !nearest || stock.expiry_date < nearest ? stock.expiry_date : nearest, null);
    return {
      phc_id: candidate.id,
      name: candidate.name,
      district: candidate.district,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      distance_km: Math.round(haversineKm(source, candidate) * 10) / 10,
      available_stock: available,
      reserve_stock: reserve,
      surplus_quantity: surplus,
      recommended_quantity: Math.min(surplus, requestedQuantity || surplus),
      nearest_expiry: nearestExpiry,
      stocks: candidate.stocks,
    };
  }).filter(candidate => candidate.surplus_quantity > 0)
    .sort((left, right) => left.distance_km - right.distance_km
      || right.surplus_quantity - left.surplus_quantity
      || new Date(left.nearest_expiry) - new Date(right.nearest_expiry));
}