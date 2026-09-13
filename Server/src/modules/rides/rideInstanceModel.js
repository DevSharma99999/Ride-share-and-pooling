import mongoose from "mongoose";

const rideInstanceSchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "RideTemplate", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    stops: { type: Array, required: true },       // copied from template at generation time
    departureDateTime: { type: Date, required: true },
    legSeatsRemaining: { type: [Number], required: true },
    bookingOpensAt: { type: Date, required: true },
    bookingClosesAt: { type: Date, required: true },
    totalRouteDistance_km: { type: Number, required: true },
    status: { type: String, enum: ["scheduled", "in_progress", "completed", "cancelled"], default: "scheduled" },
  },
  { timestamps: true }
);

export default mongoose.model("RideInstance", rideInstanceSchema);