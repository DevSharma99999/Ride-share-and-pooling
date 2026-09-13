import RideInstance from "../rides/rideInstanceModel.js";
import { calculateFare } from "../pricing/pricingService.js";

function findStopIndex(stops, name) {
  return stops.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
}

function hasEnoughSeats(instance, fromIndex, toIndex, seatsRequested) {
  for (let leg = fromIndex; leg < toIndex; leg++) {
    if (instance.legSeatsRemaining[leg] < seatsRequested) return false;
  }
  return true;
}

export async function searchRides(req, res) {
  try {
    const { from, to } = req.query;
    const seatsRequested = parseInt(req.query.seats) || 1;

    if (!from || !to) {
      return res.status(400).json({ message: "from and to query params are required" });
    }

    const now = new Date();

    // Only instances currently within their booking window are candidates
    const candidates = await RideInstance.find({
      status: "scheduled",
      bookingOpensAt: { $lte: now },
      bookingClosesAt: { $gte: now },
    });

    const matches = [];

    for (const instance of candidates) {
      const fromIndex = findStopIndex(instance.stops, from);
      const toIndex = findStopIndex(instance.stops, to);

      // Skip if either stop isn't on this route, or the rider's direction doesn't match the driver's route order
      if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) continue;

      // Skip if any leg within the requested segment doesn't have enough seats
      if (!hasEnoughSeats(instance, fromIndex, toIndex, seatsRequested)) continue;

      const fare = calculateFare(instance, fromIndex, toIndex, seatsRequested);
      const segmentDistance_km =
        instance.stops[toIndex].distanceFromStart_km - instance.stops[fromIndex].distanceFromStart_km;

      matches.push({
        rideInstanceId: instance._id,
        driverId: instance.driverId,
        departureDateTime: instance.departureDateTime,
        boardStop: instance.stops[fromIndex],
        dropStop: instance.stops[toIndex],
        segmentDistance_km,
        estimatedFare: fare,
        seatsAvailableOnSegment: Math.min(...instance.legSeatsRemaining.slice(fromIndex, toIndex)),
      });
    }

    res.status(200).json({ count: matches.length, matches });
  } catch (err) {
    res.status(500).json({ message: "Search failed", error: err.message });
  }
}