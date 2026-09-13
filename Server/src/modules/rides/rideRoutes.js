import express from "express";
import { createRideTemplate } from "./rideController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { getMyRideTemplates } from "./rideController.js";

const rideRoutes = express.Router();

rideRoutes.post("/", protect, createRideTemplate);
rideRoutes.get("/mine", protect, getMyRideTemplates);  // uncomment once you write it

export default rideRoutes;