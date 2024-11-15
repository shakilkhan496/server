import express from "express";
import authController from "../../controllers/auth.controller.js";
const router = express.Router();

router.post("/register", authController.registerSeller);
router.post("/login", authController.login);
router.delete("/logout", authController.logout);

export default router;
