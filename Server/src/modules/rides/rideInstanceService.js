import RideInstance from "./rideInstanceModel.js";

const WEEKDAY_MAP = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function buildInstanceDoc(template, vehicle, departureDateTime) {
  const totalRouteDistance_km = template.stops[template.stops.length - 1].distanceFromStart_km;
  const legCount = template.stops.length - 1;

  return {
    templateId: template._id,
    driverId: template.driverId,
    vehicleId: template.vehicleId,
    stops: template.stops,
    departureDateTime,
    legSeatsRemaining: Array(legCount).fill(vehicle.totalSeats),
    bookingOpensAt: new Date(departureDateTime.getTime() - 48 * 60 * 60 * 1000),
    bookingClosesAt: new Date(departureDateTime.getTime() - 2 * 60 * 60 * 1000),
    totalRouteDistance_km,
    status: "scheduled",
  };
}

export async function generateOneOffInstance(template, vehicle) {
  const departureDateTime = new Date(`${template.oneOff.date}T${template.oneOff.departureTime}:00`);
  const doc = buildInstanceDoc(template, vehicle, departureDateTime);
  return RideInstance.create(doc);
}

// Used now (initial creation) AND later by the daily cron job (re-run safely — skips dates that already have an instance)
export async function generateRecurringInstances(template, vehicle, rangeStart, rangeEnd) {
  const { weekdays, departureTime, startDate, endDate } = template.recurring;

  const windowStart = new Date(Math.max(new Date(startDate), new Date(rangeStart)));
  const windowEnd = endDate ? new Date(Math.min(new Date(endDate), new Date(rangeEnd))) : new Date(rangeEnd);

  const created = [];
  const cursor = new Date(windowStart);

  while (cursor <= windowEnd) {
    const dayMatches = weekdays.some((w) => WEEKDAY_MAP[w] === cursor.getDay());

    if (dayMatches) {
  const dateStr = cursor.toISOString().split("T")[0];
  const departureDateTime = new Date(`${dateStr}T${departureTime}:00`);

  if (departureDateTime > new Date()) {           // <-- add this guard
    const exists = await RideInstance.findOne({ templateId: template._id, departureDateTime });
    if (!exists) {
      const doc = buildInstanceDoc(template, vehicle, departureDateTime);
      const instance = await RideInstance.create(doc);
      created.push(instance);
    }
  }
}

    cursor.setDate(cursor.getDate() + 1);
  }

  return created;
}