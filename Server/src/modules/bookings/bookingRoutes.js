import express from "express";
import { createBooking } from "./bookingController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { getMyBookings } from "./bookingController.js";
import { cancelBooking } from "./bookingController.js";
import { verifyPayment , cancelPendingBooking } from "./bookingController.js";


const bookingRoutes = express.Router();

bookingRoutes.post("/", protect, createBooking);
bookingRoutes.get("/mine", protect, getMyBookings);  
bookingRoutes.delete("/:id", protect, cancelBooking);
bookingRoutes.post("/:id/verify-payment", protect, verifyPayment);
bookingRoutes.post("/:id/cancel-pending", protect, cancelPendingBooking);

export default bookingRoutes;