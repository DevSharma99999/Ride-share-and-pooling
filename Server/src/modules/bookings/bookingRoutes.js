import express from "express";
import { createBooking } from "./bookingController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { getMyBookings } from "./bookingController.js";
import { cancelBooking } from "./bookingController.js";

const bookingRoutes = express.Router();

bookingRoutes.post("/", protect, createBooking);
bookingRoutes.get("/mine", protect, getMyBookings);  
bookingRoutes.delete("/:id", protect, cancelBooking);

export default bookingRoutes;