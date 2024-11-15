import express from "express";
const router = express.Router();
import customerListingController from "../../controllers/customerListing.controller.js";
import { authenticateAccess } from "../../middlewares/authentication.js";

// GET Listings
router.get("/", customerListingController.getListings);
router.get(
  "/subscriptions",
  authenticateAccess,
  customerListingController.getUserSubscriptions
);
router.get("/:_listing", customerListingController.getListingByID);
router.post(
  "/checkout-listing",
  authenticateAccess,
  customerListingController.checkoutListing
);
router.post(
  "/cancel",
  authenticateAccess,
  customerListingController.cancelSubscriptionAPI
);
router.post(
  "/get-subscription",
  authenticateAccess,
  customerListingController.getSubscriptionAPI
);
router.post(
  "/subscribe-webhook",
  express.raw({ type: "application/json" }),
  customerListingController.subscribeListing
);
router.post("/renew-subscription", customerListingController.renewSubscription);
router.post("/upload-attachment", customerListingController.uploadAttachment);

export default router;
