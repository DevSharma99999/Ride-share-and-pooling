# System Design — Carpooling MVP
**Stack:** MongoDB, Express, React, Node (MERN) · **Related:** `01_prd_carpooling_mvp.md`

---

## 1. High-Level Architecture

```
┌─────────────┐        HTTPS/JSON        ┌──────────────────────┐
│   React SPA │ <──────────────────────> │   Express API server │
│ (client)    │                          │   (Node.js)          │
└─────────────┘                          └──────────┬───────────┘
                                                     │
                          ┌──────────────────────────┼───────────────────────┐
                          │                          │                       │
                   ┌──────▼───────┐         ┌────────▼────────┐     ┌────────▼────────┐
                   │   MongoDB    │         │  Cron / Job      │     │  External: Maps │
                   │ (Mongoose)   │         │  Runner          │     │  Distance API    │
                   └──────────────┘         │ (node-cron)      │     │  (stub for now)  │
                                             │ - materialize    │     └──────────────────┘
                                             │   recurring      │
                                             │   instances      │
                                             └──────────────────┘
```

**Modular monolith** for MVP — one Express app, but code organized into clearly separated modules (folders) so each could be extracted into a microservice later if needed:
- `auth/` — signup, login, JWT
- `users/` — profile, roles
- `vehicles/` — driver vehicle CRUD
- `rides/` — ride templates + instance generation
- `matching/` — search & segment matching logic
- `pricing/` — fare calculation engine
- `bookings/` — booking creation, seat-per-leg logic, cancellation
- `notifications/` — basic event-based notices

---

## 2. Data Model (MongoDB / Mongoose)

### 2.1 Entity Relationship Overview

```
User ──1:N──> Vehicle
User ──1:N──> RideTemplate (as driver)
RideTemplate ──1:N──> RideInstance
RideInstance ──1:N──> Booking
User ──1:N──> Booking (as rider)
```

### 2.2 Key design decision: modeling stops & legs

Every route is stored as an **ordered array of stops**. Between consecutive stops is a **leg**. Seat availability is tracked **per leg**, not as a single counter — this is what makes overlapping partial-route bookings work correctly.

```js
// RideTemplate.stops (subdocument array)
stops: [
  { stopIndex: 0, name: "Sector 21", lat: .., lng: .., distanceFromStart_km: 0 },
  { stopIndex: 1, name: "Sector 14", lat: .., lng: .., distanceFromStart_km: 4.2 },
  { stopIndex: 2, name: "Cyber Hub",  lat: .., lng: .., distanceFromStart_km: 9.8 },
  { stopIndex: 3, name: "Sector 44",  lat: .., lng: .., distanceFromStart_km: 15.0 }
]
```

A **leg** is implicitly `(stopIndex i → stopIndex i+1)`. For N stops there are N-1 legs. On each `RideInstance`, we store a parallel array `legSeatsRemaining: [3, 2, 3]` (one entry per leg), initialized to the vehicle's total seats.

**Booking a segment from stop 1 → stop 3** decrements `legSeatsRemaining[1]` and `legSeatsRemaining[2]` (the legs it actually spans) by the number of seats booked. A new search/booking is only allowed if **every leg in the requested segment** has enough remaining seats.

This directly implements PRD FR-10/FR-11.

### 2.3 Schemas (simplified)

```js
// User
{
  _id, name, email, passwordHash,
  roles: ["rider" | "driver"],   // can be both
  createdAt
}

// Vehicle
{
  _id, driverId: ObjectId(User), make, model, plateNumber, totalSeats
}

// RideTemplate
{
  _id, driverId: ObjectId(User), vehicleId: ObjectId(Vehicle),
  stops: [ { stopIndex, name, lat, lng, distanceFromStart_km } ],
  scheduleType: "one_off" | "recurring",
  oneOff: { date, departureTime },              // if one_off
  recurring: {                                   // if recurring
    weekdays: ["MON","TUE","WED","THU","FRI"],
    departureTime: "08:00",
    startDate, endDate,                          // endDate optional (null = until cancelled)
  },
  status: "active" | "cancelled",
  createdAt
}

// RideInstance  (generated from a RideTemplate, or directly for one-off rides)
{
  _id, templateId: ObjectId(RideTemplate), driverId, vehicleId,
  stops: [ ...copied from template at generation time... ],
  departureDateTime: ISODate,
  legSeatsRemaining: [Number],   // length = stops.length - 1
  bookingOpensAt: ISODate,       // departureDateTime - 48h
  bookingClosesAt: ISODate,      // departureDateTime - 2h
  status: "scheduled" | "in_progress" | "completed" | "cancelled",
  totalRouteDistance_km: Number
}

// Booking
{
  _id, riderId: ObjectId(User), rideInstanceId: ObjectId(RideInstance),
  boardStopIndex: Number, dropStopIndex: Number,
  seatsBooked: Number,
  segmentDistance_km: Number,
  fare: Number,
  status: "confirmed" | "cancelled_by_rider" | "cancelled_by_driver" | "completed" | "no_show",
  cancelledAt: ISODate,
  refundAmount: Number,
  createdAt
}
```

---

## 3. Core Algorithms (pseudocode)

### 3.1 Fare calculation (PRD FR-12)
```js
function calculateFare(rideInstance, boardStopIndex, dropStopIndex, seats, ratePerKm) {
  const segmentDistance = rideInstance.stops[dropStopIndex].distanceFromStart_km
                         - rideInstance.stops[boardStopIndex].distanceFromStart_km;
  const totalTripCost = rideInstance.totalRouteDistance_km * ratePerKm;
  const farePerSeat = (segmentDistance / rideInstance.totalRouteDistance_km) * totalTripCost;
  return farePerSeat * seats;
}
```

### 3.2 Seat availability check across a segment (PRD FR-10/11)
```js
function canBookSegment(rideInstance, boardStopIndex, dropStopIndex, seatsRequested) {
  for (let leg = boardStopIndex; leg < dropStopIndex; leg++) {
    if (rideInstance.legSeatsRemaining[leg] < seatsRequested) return false;
  }
  return true;
}
```
This check + the decrement must happen **atomically** to avoid race conditions (two riders booking the last seat simultaneously). In MongoDB we'll do this with a single `findOneAndUpdate` using a query filter that requires each relevant leg to have enough seats, e.g. via `$expr`/array-index conditions — full query designed at implementation time. If MongoDB's atomic update can't cleanly express the multi-leg condition, we fall back to a **transaction** (MongoDB supports multi-document ACID transactions) wrapping the read-check-write.

### 3.3 Cancellation fee (PRD section 8.2)
```js
function resolveCancellation(booking, rideInstance, cancelledBy) {
  const hoursToDeparture = (rideInstance.departureDateTime - now()) / 3600000;
  if (cancelledBy === "driver") return { refundPercent: 100 };
  if (now() > rideInstance.departureDateTime) return { refundPercent: 0 };
  if (hoursToDeparture > 24) return { refundPercent: 100 };
  return { refundPercent: 50 };
}
```

### 3.4 Recurring instance materialization (cron job, PRD FR-3)
```js
// Runs daily
for (const template of activeRecurringTemplates) {
  for (const date of next2Days()) {
    if (matchesWeekday(template, date) && !instanceAlreadyExists(template, date)) {
      createRideInstance(template, date);
    }
  }
}
```

---

## 4. API Contract (v1 draft)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/users/me` | Current user profile |
| POST | `/api/vehicles` | Driver adds a vehicle |
| POST | `/api/ride-templates` | Create ride template (one-off or recurring) |
| PATCH | `/api/ride-templates/:id` | Edit template (only affects bookingless future instances) |
| DELETE | `/api/ride-templates/:id` | Cancel entire series |
| GET | `/api/ride-instances/search?from=&to=&date=` | Search bookable instances by stop pair |
| DELETE | `/api/ride-instances/:id` | Driver cancels a single instance |
| POST | `/api/bookings` | Rider books a segment (body: rideInstanceId, boardStopIndex, dropStopIndex, seats) |
| DELETE | `/api/bookings/:id` | Cancel a booking (applies fee tiers) |
| GET | `/api/bookings/mine` | Rider's bookings |
| GET | `/api/ride-instances/mine` | Driver's upcoming instances |

*(Exact request/response JSON shapes to be written as we implement each endpoint — kept lightweight here to avoid over-designing before we've written real code.)*

---

## 5. What we build first (implementation order)

1. Project scaffolding (client + server, env config, DB connection)
2. Auth + User module
3. Vehicle module
4. Ride Template creation (one-off first, then recurring + cron materialization)
5. Search/matching (stops-only)
6. Booking creation with per-leg seat logic (the hard part — we'll test this carefully)
7. Pricing engine
8. Cancellation flow
9. Basic notifications
10. Polish + deploy

This mirrors the roadmap's phases but is now concrete enough to start coding.