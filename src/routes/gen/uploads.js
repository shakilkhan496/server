import express from "express";
import genController from "../../controllers/gen.controller.js";

const router = express.Router();

router.post("/preSignedURL", genController.getPresignedURL);

export default router;
