import express from "express";
import { register } from "./authController.js";
import { login } from "./authController.js";

const authRoutes = express.Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);

export default authRoutes;