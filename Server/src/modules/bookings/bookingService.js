import mongoose from "mongoose";
import Booking from "./bookingModel.js";
import RideInstance from "../rides/rideInstanceModel.js";

export async function releasePendingBooking(bookingId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking || booking.status !== "pending_payment") {
      await session.abortTransaction();
      return;
    }

    const instance = await RideInstance.findById(booking.rideInstanceId).session(session);
    for (let leg = booking.boardStopIndex; leg < booking.dropStopIndex; leg++) {
      instance.legSeatsRemaining[leg] += booking.seatsBooked;
    }
    await instance.save({ session });

    booking.status = "expired";
    await booking.save({ session });

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.error("Failed to release pending booking:", err);
  } finally {
    session.endSession();
  }
}