import express from "express";
const router = express.Router();

// Seller Auth Routes
import sellerAuthRoutes from "./seller.js";
// User Auth Routes
import userAuthRoutes from "./user.js";

router.use("/seller", sellerAuthRoutes);
router.use("/user", userAuthRoutes);

export default router;
