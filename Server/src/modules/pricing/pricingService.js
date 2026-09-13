const RATE_PER_KM = parseFloat(process.env.RATE_PER_KM) || 8;

export const calculateFare = (rideInstance, boardStopIndex, dropStopIndex, seats) => {
  const segmentDistance =
    rideInstance.stops[dropStopIndex].distanceFromStart_km -
    rideInstance.stops[boardStopIndex].distanceFromStart_km;

  const totalTripCost = rideInstance.totalRouteDistance_km * RATE_PER_KM;

  const farePerSeat = (segmentDistance / rideInstance.totalRouteDistance_km) * totalTripCost;

  return Math.round(farePerSeat * seats * 100) / 100;
};