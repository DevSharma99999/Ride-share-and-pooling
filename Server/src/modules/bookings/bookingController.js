import mongoose from "mongoose";
import RideInstance from "../rides/rideInstanceModel.js";
import Booking from "./bookingModel.js";
import { calculateFare } from "../pricing/pricingService.js";
import { createNotification } from "../notifications/notificationService.js";

export async function createBooking(req, res) {
  const { rideInstanceId, boardStopIndex, dropStopIndex, seats } = req.body;

  if (
    !rideInstanceId ||
    boardStopIndex === undefined ||
    dropStopIndex === undefined ||
    !seats
  ) {
    return res.status(400).json({
      message: "rideInstanceId, boardStopIndex, dropStopIndex, and seats are required",
    });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // .session(session) ties this read into the transaction
    const instance = await RideInstance.findById(rideInstanceId).session(session);

    if (!instance || instance.status !== "scheduled") {
      throw { statusCode: 404, message: "Ride instance not found or not bookable" };
    }

    const now = new Date();
    if (now < instance.bookingOpensAt || now > instance.bookingClosesAt) {
      throw { statusCode: 400, message: "Booking window is not open for this ride" };
    }

    if (
      boardStopIndex < 0 ||
      dropStopIndex >= instance.stops.length ||
      boardStopIndex >= dropStopIndex
    ) {
      throw { statusCode: 400, message: "Invalid stop range" };
    }

    // Check every leg in the segment has enough seats
    for (let leg = boardStopIndex; leg < dropStopIndex; leg++) {
      if (instance.legSeatsRemaining[leg] < seats) {
        throw { statusCode: 409, message: `Not enough seats available on leg ${leg}` };
      }
    }

    // Decrement every leg in the segment
    for (let leg = boardStopIndex; leg < dropStopIndex; leg++) {
      instance.legSeatsRemaining[leg] -= seats;
    }
    await instance.save({ session });

    const fare = calculateFare(instance, boardStopIndex, dropStopIndex, seats);
    const segmentDistance_km =
      instance.stops[dropStopIndex].distanceFromStart_km - instance.stops[boardStopIndex].distanceFromStart_km;

    const [booking] = await Booking.create(
      [
        {
          riderId: req.user._id,
          rideInstanceId,
          boardStopIndex,
          dropStopIndex,
          seatsBooked: seats,
          segmentDistance_km,
          fare,
          status: "confirmed",
        },
      ],
      { session }
    );
    await createNotification(
      req.user._id,
      "booking_confirmed",
      `Your booking for ${fare} is confirmed.`,
      booking._id,
      session
    );

    await createNotification(
      instance.driverId,
      "booking_confirmed",
      `A new booking was made on your ride departing ${instance.departureDateTime.toDateString()}.`,
      booking._id,
      session
    );
    await session.commitTransaction();
    res.status(201).json({ booking });
  } catch (err) {
    await session.abortTransaction();
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ message: err.message || "Booking failed" });
  } finally {
    session.endSession();
  }
}

export const getMyBookings = async (req,res)=>{
    try {
        const bookings = await Booking.find({riderId : req.user._id});
        return res.status(200).json({
            success:true,
            message:"booking fatched successfully",
            bookings
        })
    } catch (error) {
        console.error("error while booking", error);
        return res.status(500).json({
            success:false,
            message:"error in booking"
        });
    }
}

export async function cancelBooking(req, res) {
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const booking = await Booking.findById(id).session(session);
    if (!booking) {
      throw { statusCode: 404, message: "Booking not found" };
    }
    if (String(booking.riderId) !== String(req.user._id)) {
      throw { statusCode: 403, message: "You can only cancel your own bookings" };
    }
    if (booking.status !== "confirmed") {
      throw { statusCode: 400, message: "Only confirmed bookings can be cancelled" };
    }

    const instance = await RideInstance.findById(booking.rideInstanceId).session(session);
    if (!instance) {
      throw { statusCode: 404, message: "Associated ride instance not found" };
    }

    // Fee tiers — PRD section 8.2
    const now = new Date();
    let refundPercent;
    if (now > instance.departureDateTime) {
      refundPercent = 0; // after departure / no-show
    } else {
      const hoursToDeparture = (instance.departureDateTime - now) / (1000 * 60 * 60);
      refundPercent = hoursToDeparture > 24 ? 100 : 50;
    }

    // Restore seats on every leg this booking occupied
    for (let leg = booking.boardStopIndex; leg < booking.dropStopIndex; leg++) {
      instance.legSeatsRemaining[leg] += booking.seatsBooked;
    }
    await instance.save({ session });

    booking.status = "cancelled_by_rider";
    booking.cancelledAt = now;
    booking.refundAmount = Math.round(((booking.fare * refundPercent) / 100) * 100) / 100;
    await booking.save({ session });

    await createNotification(
      booking.riderId,
      "booking_cancelled",
      `Your booking has been cancelled. Refund amount: ${booking.refundAmount}.`,
      booking._id,
      session
    );
    await createNotification(
      instance.driverId,
      "booking_cancelled",
      `A rider cancelled their booking on your ride departing ${instance.departureDateTime.toDateString()}.`,
      booking._id,
      session
    );
    await session.commitTransaction();
    res.status(200).json({ booking });
  } catch (err) {
    await session.abortTransaction();
    res.status(err.statusCode || 500).json({ message: err.message || "Cancellation failed" });
  } finally {
    session.endSession();
  }
}