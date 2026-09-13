import RideTemplate from "./rideTemplateModel.js";
import Vehicle from "../vehicles/vehicleModel.js";
import { generateOneOffInstance, generateRecurringInstances } from "./rideInstanceService.js";

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
// export async function getMyRideTemplates(req, res) { ... } <-- your turn, see exercise below