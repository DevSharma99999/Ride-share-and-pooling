import express from "express";
import { cancelRideInstance } from "./rideController.js";
import { protect } from "../../middleware/authMiddleware.js";

const rideInstanceRoutes = express.Router();

rideInstanceRoutes.delete("/:id", protect, cancelRideInstance);

export default rideInstanceRoutes;