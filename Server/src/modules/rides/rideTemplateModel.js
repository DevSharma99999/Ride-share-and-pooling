import mongoose from "mongoose";

const stopSchema = new mongoose.Schema(
  {
    stopIndex: { type: Number, required: true },
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    distanceFromStart_km: { type: Number, required: true },
  },
  { _id: false }
);

const rideTemplateSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    stops: { type: [stopSchema], required: true },
    scheduleType: { type: String, enum: ["one_off", "recurring"], required: true },
    oneOff: {
      date: String,          // "2026-09-20"
      departureTime: String, // "08:00"
    },
    recurring: {
      weekdays: [String],    // ["MON","WED","FRI"]
      departureTime: String,
      startDate: String,
      endDate: String,       // optional, null = until cancelled
    },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("RideTemplate", rideTemplateSchema);