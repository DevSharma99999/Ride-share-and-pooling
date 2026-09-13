import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    plateNumber: { type: String, required: true, trim: true, uppercase: true },
    totalSeats: { type: Number, required: true, min: 1, max: 8 },
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);