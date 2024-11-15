import express from "express";
const router = express.Router();
import uploadRoutes from "./uploads.js";

router.use("/uploads", uploadRoutes);

export default router;
