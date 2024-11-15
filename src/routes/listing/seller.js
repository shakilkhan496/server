import express from "express";
const router = express.Router();
import sellerListingController from "../../controllers/sellerListing.controller.js";
import { authenticateAccess } from "../../middlewares/authentication.js";

// GET Listings
router.get("/", sellerListingController.getSellerListings);
router.get("/seller",sellerListingController.getSeller);
// Get Seller Listings' Subscriptions
router.get(
  "/subscriptions",
  authenticateAccess,
  sellerListingController.getSellerListingSubscriptions
);
// GET Listing BY ID
router.get("/:_listing", sellerListingController.getListingByID);
// POST Add New Listing
router.post("/", sellerListingController.addNewListing);
// PUT Update Listing
router.put("/", sellerListingController.updateListing);
// DELETE Delete Listing
router.delete("/", sellerListingController.deleteListing);

export default router;
