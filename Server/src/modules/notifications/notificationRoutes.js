import express from "express";
import { getMyNotifications } from "./notificationController.js";
import { protect } from "../../middleware/authMiddleware.js";

const notificationRoutes = express.Router();

notificationRoutes.get("/mine", protect, getMyNotifications);

export default notificationRoutes;