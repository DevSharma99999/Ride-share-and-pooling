import express from "express";
import mongoose from "mongoose";
import cors from "cors";

export const app= express();

app.use(cors());
app.use(express.json());

app.get("/api/health",(req,res)=>{
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});