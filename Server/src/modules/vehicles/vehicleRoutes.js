import express from "express";
import { addVehicle } from "./vehicleController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { getMyVehicles } from "./vehicleController.js";

const vehicleRoutes = express.Router();

vehicleRoutes.post("/", protect, addVehicle);
vehicleRoutes.get("/mine", protect, getMyVehicles);  // uncomment once you write it

export default vehicleRoutes;