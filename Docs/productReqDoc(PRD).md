# Product Requirements Document (PRD)
## Module: Carpooling (MVP) — RideShare Platform

**Status:** Draft v1
**Owner:** You (Product/Eng) + Claude (Design/Eng partner)
**Related doc:** `00_project_roadmap.md`

---

## 1. Overview

A carpooling module for daily/regular passengers (e.g., office commuters). Drivers offer a route with multiple stops and available seats; riders book a segment of that route (not necessarily the full route). Fare is calculated by the platform based on distance traveled, not set by the driver. Supports both **one-off rides** and **recurring rides** (e.g., Mon–Fri same route/time).

This is **not** on-demand — bookings open a fixed window (1–2 days) before departure. Immediate/real-time matching is out of scope for this module (that's the separate Cab module, built later).

---

## 2. Goals

- Let a driver publish a route once (with stops) and have riders discover and book segments of it.
- Split fare fairly by distance actually traveled by each passenger.
- Support daily commuters via recurring rides, without forcing the driver to re-post every day.
- Enforce a booking window and a cancellation-fee policy to reduce no-shows/last-minute drops.
- Keep the system correct under concurrency (two riders can't overbook the same seat).

## 3. Non-Goals (out of scope for this module/MVP)
- On-demand/instant cab hailing (separate module, later)
- Long-trip early reservations with discounts (separate module, later)
- Real payment gateway integration (mock/stub payment for now)
- AI-based distance/ETA prediction (stubbed with a maps-distance calculation for now)
- Live GPS tracking of the vehicle in transit
- Admin dashboard / analytics (basic admin CRUD only, if time permits)

---

## 4. Personas

| Persona | Description | Key needs |
|---|---|---|
| **Driver** | Commutes regularly by car, has spare seats | Post a route once, let it recur, minimal management overhead, fair pay for seats used |
| **Rider (commuter)** | Needs a regular ride to work, cost-sensitive | Find a ride matching their partial route, predictable fare, reliable booking |
| **Admin** (minimal, stretch) | Platform operator | View rides/users, handle disputes (basic only) |

---

## 5. Core Concepts & Definitions

- **Ride Template**: A route definition created by a driver — ordered list of stops (with lat/lng), a vehicle, total seats offered, and either a one-off date/time or a recurrence rule (e.g., "Mon–Fri, depart 8:00 AM").
- **Ride Instance**: A single, concrete occurrence of a Ride Template on a specific date. Bookings are always made against a Ride Instance, never directly against a Template. One-off rides produce exactly one instance; recurring rides generate one instance per occurrence.
- **Segment**: The portion of a Ride Instance's route between a rider's boarding stop and drop-off stop.
- **Booking**: A rider's reservation of 1+ seats for a specific segment of a specific Ride Instance.

---

## 6. Functional Requirements

### 6.1 Driver: Ride Template Creation
- **FR-1**: Driver can create a Ride Template with: origin, destination, an ordered list of intermediate stops (each with location + estimated arrival offset), total vacant seats, and a vehicle (from their registered vehicles).
- **FR-2**: Driver chooses either:
  - **One-off**: a single date + departure time, or
  - **Recurring**: a set of weekdays (e.g., Mon/Wed/Fri) + a departure time + a start date and an end date (or "until cancelled").
- **FR-3**: The system auto-generates Ride Instances from a Recurring Template on a rolling basis (e.g., always keep the next 14 days of instances materialized), so riders can only book instances within the actual booking window, not the abstract template.
- **FR-4**: Driver can cancel a single upcoming Ride Instance or the entire recurring series (future instances only; past/completed instances are untouched).
- **FR-5**: Driver can edit a Ride Template's future instances (e.g., change time) — this does not retroactively affect already-booked instances without triggering re-confirmation/notification to affected riders (flag for design; exact behavior TBD in system design phase).

### 6.2 Rider: Search & Discovery
- **FR-6**: Rider searches by entering a boarding point and a drop-off point (+ a date, or a weekday for recurring intent) and sees matching Ride Instances where their segment lies along the driver's route in the correct direction and order.
- **FR-7**: Search results show: available seats remaining for that segment specifically (not just total ride seats — see 6.4), estimated fare for the segment, estimated pickup/drop-off time.

### 6.3 Booking Window
- **FR-8**: A Ride Instance only becomes bookable starting **48 hours** before its departure and closes at a configurable cutoff (e.g., 2 hours before departure). *(Exact hours configurable; default 48h open / 2h close.)*
- **FR-9**: For recurring rides, this means each instance opens for booking independently — a rider cannot book next Thursday's instance today if today is more than 48h before it.

### 6.4 Seat Availability Across Overlapping Segments
- **FR-10**: Seats are consumed **per overlapping segment**, not just as a flat total. Example: a driver has 3 seats. Rider A books stop 1→3. Rider B books stop 2→4. If their segments overlap (e.g., both occupy the 2→3 leg), the combined seats used on that leg must not exceed capacity. The system must track seat occupancy **per leg** of the route, not just a single counter.
- **FR-11**: When two riders attempt to book overlapping segments that would exceed capacity on any shared leg, the second request is rejected (or offered the next available instance) — this must be handled safely under concurrent requests (no double-booking race condition).

### 6.5 Fare Calculation
- **FR-12**: Fare for a booking is calculated by the platform as: `(distance of rider's segment / total route distance) × total trip cost estimate`, or a simpler per-km rate — exact formula finalized in the pricing design step. Driver does **not** set the fare.
- **FR-13**: Fare is shown to the rider at search/results time (estimate) and locked in at booking confirmation.

### 6.6 Booking & Confirmation
- **FR-14**: Rider selects a Ride Instance + boarding/drop-off stop + seat count, sees the fare, and confirms.
- **FR-15**: On confirmation, seats are decremented on all legs within the rider's segment; booking status = confirmed.

### 6.7 Cancellation Policy
- **FR-16**: Rider or driver can cancel a confirmed booking/instance before departure.
- **FR-17**: A cancellation fee applies based on how close to departure the cancellation happens (e.g., free >24h before, partial fee 6–24h, higher fee <6h). Exact tiers finalized in design step.
- **FR-18**: If a **driver** cancels an instance, all affected riders are refunded in full (no fee) and notified.

### 6.8 Notifications (basic)
- **FR-19**: Riders/drivers receive an in-app (and optionally email) notification on: booking confirmed, ride cancelled (by either party), reminder before departure.

---

## 7. Non-Functional Requirements

- **NFR-1 (Consistency)**: Seat booking must be atomic/consistent — no overbooking under concurrent requests.
- **NFR-2 (Usability)**: Search-to-booking flow should be completable in a handful of steps; this is a portfolio project so UX polish matters for demo value.
- **NFR-3 (Maintainability)**: Clear separation of concerns (route/matching logic, pricing engine, booking engine as distinct modules) since this is the most reusable part for later modules.
- **NFR-4 (Scalability)**: Not a priority for MVP (single-region, moderate load assumption), but data model shouldn't actively block scaling later.
- **NFR-5 (Security)**: Standard auth (JWT), password hashing, basic input validation/authorization checks (a rider can't cancel someone else's booking, etc.).

---

## 8. Key Open Decisions (to resolve in System Design phase)

1. Exact pricing formula (flat per-km vs. proportional-of-total-trip-cost).
2. Exact cancellation fee tiers/percentages.
3. Behavior when a driver edits a recurring template that already has bookings on affected future instances (auto-cancel & refund? lock edits if bookings exist? notify + require re-confirm?).
4. How far ahead recurring instances are materialized (rolling window size) and whether this is a scheduled job (cron) or generated lazily on search.
5. Whether partial-route bookings require the rider's segment to be *exactly* between two of the driver's declared stops, or any two points along the route (MVP recommendation: stops only, to keep matching tractable — extendable later).

---

## 9. Success Criteria for MVP Demo

- A driver can create both a one-off and a recurring multi-stop ride.
- Two different riders can book overlapping-but-not-conflicting segments of the same instance and see correct remaining seat counts.
- Fare shown is proportional to distance and consistent between search and confirmation.
- Cancelling within different time windows produces different (correct) fee outcomes.
- No double-booking possible when tested with concurrent requests.
