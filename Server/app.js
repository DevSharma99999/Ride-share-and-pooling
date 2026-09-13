import express from "express";
import cors from "cors";

import authRoutes from "./src/modules/auth/authRoutes.js";
import userRoutes from "./src/modules/users/userRoutes.js";
import vehicleRoutes from "./src/modules/vehicles/vehicleRoutes.js";
import rideRoutes from "./src/modules/rides/rideRoutes.js";

export const app= express();

app.use(cors());
app.use(express.json());

app.get("/api/health",(req,res)=>{
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/rides",rideRoutes);