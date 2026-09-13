import express from "express";
import { searchRides } from "./matchingController.js";
import { protect } from "../../middleware/authMiddleware.js";

const matchingRoutes = express.Router();

matchingRoutes.get("/search", protect, searchRides);

export default matchingRoutes;