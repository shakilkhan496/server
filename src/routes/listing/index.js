import express from "express";
const router = express.Router();
import sellerListingRoutes from "./seller.js";
import customerListingRoutes from "./customer.js";
import { authenticateAccess } from "../../middlewares/authentication.js";

router.use("/customer", customerListingRoutes);
router.use("/seller", authenticateAccess, sellerListingRoutes);

export default router;
