import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rideInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: "RideInstance", required: true },
    boardStopIndex: { type: Number, required: true },
    dropStopIndex: { type: Number, required: true },
    seatsBooked: { type: Number, required: true },
    segmentDistance_km: { type: Number, required: true },
    fare: { type: Number, required: true },
    status: {
  type: String,
    enum: [
      "pending_payment",
      "confirmed",
      "cancelled_by_rider",
      "cancelled_by_driver",
      "completed",
      "no_show",
    "expired",
      ],
      default: "pending_payment",
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    expiresAt: Date,
    cancelledAt: Date,
    refundAmount: Number,
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);