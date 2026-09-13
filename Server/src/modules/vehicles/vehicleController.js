import Vehicle from "./vehicleModel.js";
import User from "../users/userModel.js";

export async function addVehicle(req, res) {
  try {
    const { make, model, plateNumber, totalSeats } = req.body;

    if (!make || !model || !plateNumber || !totalSeats) {
      return res.status(400).json({ message: "make, model, plateNumber, and totalSeats are required" });
    }

    const vehicle = await Vehicle.create({
      driverId: req.user._id,
      make,
      model,
      plateNumber,
      totalSeats,
    });

    // Progressive role enablement: adding a vehicle makes you a driver
    if (!req.user.roles.includes("driver")) {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { roles: "driver" } });
    }

    res.status(201).json({ vehicle });
  } catch (err) {
    res.status(500).json({ message: "Failed to add vehicle", error: err.message });
  }
}
export const getMyVehicles = async (req,res)=>{
  try{
  const vehicle= await Vehicle.find({ driverId: req.user._id });
  if(!vehicle){
    return res.status(401).json({
      message:"No Car Registered By You"
    })
  }
  res.status(200).json({
    success:true,
    vehicle
  })
}catch(err){
  console.error("error while fetching vehicle details",err);
  res.status(500).json({
    message: "error while seraching registred vehicle"
  });
}
}
// export async function getMyVehicles(req, res) { ... } <-- your turn, see exercise below