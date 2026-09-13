import express from "express";
import { protect } from "../../middleware/authMiddleware.js";

const userRoutes = express.Router();

userRoutes.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

export default userRoutes;