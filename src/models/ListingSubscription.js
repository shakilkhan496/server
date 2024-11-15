import mongoose from "mongoose";

const ListingSubscriptionSchema = new mongoose.Schema(
  {
    _listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "listing",
      required: true,
    },
    subscription_id:{
      type: String,
      required: false,
    },
    _seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    _user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    billingID: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const ListingSubscription = mongoose.model(
  "listingSubscription",
  ListingSubscriptionSchema
);

export default ListingSubscription;
