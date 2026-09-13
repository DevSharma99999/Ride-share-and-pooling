import { generateOneOffInstance, generateRecurringInstances } from "./rideInstanceService.js";
import RideTemplate from "./rideTemplateModel.js";
import Vehicle from "../vehicles/vehicleModel.js";
import Booking from "../bookings/bookingModel.js";
import RideInstance from "./rideInstanceModel.js";
import { createNotification } from "../notifications/notificationService.js";
import mongoose from "mongoose";

export async function createRideTemplate(req, res) {
  try {
    const { vehicleId, stops, scheduleType, oneOff, recurring } = req.body;

    if (!vehicleId || !stops || !scheduleType) {
      return res.status(400).json({ message: "vehicleId, stops, and scheduleType are required" });
    }
    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ message: "at least 2 stops are required" });
    }
    if (scheduleType === "one_off" && (!oneOff || !oneOff.date || !oneOff.departureTime)) {
      return res.status(400).json({ message: "oneOff.date and oneOff.departureTime are required" });
    }
    if (scheduleType === "recurring" && (!recurring || !recurring.weekdays?.length || !recurring.departureTime || !recurring.startDate)) {
      return res.status(400).json({ message: "recurring.weekdays, departureTime, and startDate are required" });
    }

    // Ownership check — this vehicle must belong to the logged-in driver
    const vehicle = await Vehicle.findOne({ _id: vehicleId, driverId: req.user._id });
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found or not owned by you" });
    }

    const template = await RideTemplate.create({
      driverId: req.user._id,
      vehicleId,
      stops,
      scheduleType,
      oneOff: scheduleType === "one_off" ? oneOff : undefined,
      recurring: scheduleType === "recurring" ? recurring : undefined,
    });

    let instances = [];
    if (scheduleType === "one_off") {
      instances = [await generateOneOffInstance(template, vehicle)];
    } else {
      const rangeStart = new Date();
      const rangeEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      instances = await generateRecurringInstances(template, vehicle, rangeStart, rangeEnd);
    }

    res.status(201).json({ template, instances });
  } catch (err) {
    res.status(500).json({ message: "Failed to create ride template", error: err.message });
  }
}

export const getMyRideTemplates = async (req,res)=>{
     try{
    const template = await RideTemplate.find({ driverId: req.user._id });
    if(!template){
        return res.status(400).json({
            success:false,
            message:"No template found"
        });
    }
    return res.status(200).json({
        success:true,
        template
    });
}catch(err){
    console.error("error while searching for template ",err);
    res.status(500).json({
        message:"internal server error while searching template"
    })
}
}


export async function cancelRideInstance(req, res) {
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const instance = await RideInstance.findById(id).session(session);
    if (!instance) {
      throw { statusCode: 404, message: "Ride instance not found" };
    }
    if (String(instance.driverId) !== String(req.user._id)) {
      throw { statusCode: 403, message: "You can only cancel your own ride instances" };
    }
    if (instance.status !== "scheduled") {
      throw { statusCode: 400, message: "Only scheduled instances can be cancelled" };
    }

    instance.status = "cancelled";
    await instance.save({ session });

    // Driver-initiated cancellation = always full refund, regardless of timing (PRD 8.2)
    const affectedBookings = await Booking.find({
      rideInstanceId: id,
      status: "confirmed",
    }).session(session);

    for (const booking of affectedBookings) {
      booking.status = "cancelled_by_driver";
      booking.cancelledAt = new Date();
      booking.refundAmount = booking.fare; // 100%
      await booking.save({ session });

      await createNotification(
        booking.riderId,
        "booking_cancelled",
        `Your booking was cancelled by the driver for the ride departing ${instance.departureDateTime.toDateString()}. You'll receive a full refund of ${booking.fare}.`,
        booking._id,
        session
      );
    }

    await session.commitTransaction();
    res.status(200).json({
      message: "Ride instance cancelled",
      affectedBookingsCount: affectedBookings.length,
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(err.statusCode || 500).json({ message: err.message || "Cancellation failed" });
  } finally {
    session.endSession();
  }
}

export const cancelRideTemplate = async (req, res) => {
  try {
    const template = await RideTemplate.findOne({ _id: req.params.id, driverId: req.user._id });
    if (!template) {
      return res.status(404).json({ message: "Ride template not found or not owned by you" });
    }

    template.status = "cancelled";
    await template.save();

    return res.status(200).json({ template });
  } catch (error) {
    console.error("error in cancel ride template", error);
    return res.status(500).json({
      success: false,
      message: "internal error in cancelling ride template",
    });
  }
};