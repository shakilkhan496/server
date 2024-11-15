import Listing from "../models/Listing.js";
import ListingSubscription from "../models/ListingSubscription.js";
import { BadRequest, ServerError } from "../utils/errors.js";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const getSellerListings = async (req, res) => {
  try {
    const { user, searchKeyword, skip, limit } = req;
    console.log(user)

    const listingFilter = { _seller: user._id, isDeleted: false };
    if (searchKeyword)
      listingFilter.title = { $regex: new RegExp(searchKeyword, "i") };

    const listings = await Listing.find(listingFilter)
      .populate({ model: "user", path: "_seller" })
      .sort({ createdAt: -1 })
      .skip(skip || 0)
      .limit(limit || 20);

    res.send({ listings });
  } catch (error) {
    ServerError(res, error?.message);
  }
};
const getSeller= async (req, res) => {
  const { user, searchKeyword, skip, limit } = req;
  res.send({ user });
}

const addNewListing = async (req, res) => {
  try {
    const { user, body } = req;
    const {
      title,
      description,
      image,
      dailyPricing,
      weeklyPricing,
      monthlyPricing,
      yearlyPricing,
      width,
      height,
    } = body;

    if (user.type !== "seller")
      return BadRequest(res, "Only sellers can add listings!");

    const listing = new Listing({
      title,
      description,
      image,
      dailyPricing,
      weeklyPricing,
      monthlyPricing,
      yearlyPricing,
      width,
      height,
      _seller: user._id,
    });

    await listing.save();
    await listing.populate({ model: "user", path: "_seller" });

    res.send({ listing });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const updateListing = async (req, res) => {
  try {
    const { user, body } = req;
    const {
      _id,
      title,
      description,
      image,
      dailyPricing,
      weeklyPricing,
      monthlyPricing,
      yearlyPricing,
      isListed,
      width,
      height,
    } = body;

    const listing = await Listing.findOne({
      _id,
      _seller: user._id,
      isDeleted: false,
    });
    if (!listing) return BadRequest(res, "Listing not found!");

    const updatedListing = await Listing.findByIdAndUpdate(
      _id,
      {
        title,
        description,
        image,
        dailyPricing,
        weeklyPricing,
        monthlyPricing,
        yearlyPricing,
        isListed,
        width,
        height,
      },
      { new: true }
    ).populate({ model: "user", path: "_seller" });

    res.send({
      listing: updatedListing,
      message: "Listing updated successfully!",
    });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const deleteListing = async (req, res) => {
  try {
    const { user, body } = req;
    const { _listing } = body;

    const listing = await Listing.findOne({
      _id: _listing,
      _seller: user._id,
      isDeleted: false,
    });
    if (!listing) return BadRequest(res, "Listing not found!");

    await Listing.findByIdAndUpdate(
      _listing,
      { isDeleted: true },
      { new: true }
    );

    res.send({ message: "Listing deleted successfully!" });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const getListingByID = async (req, res) => {
  try {
    const { user, params } = req;
    const { _listing } = params;

    const listing = await Listing.findOne({
      _id: _listing,
      _seller: user._id,
      isDeleted: false,
    });
    if (!listing) return BadRequest(res, "Listing not found!");

    res.send({ listing });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

// Function to map subscriptions
const updateSubscriptionsWithMarkedForCancel = async (subscriptions) => {
  try {
    // Use `Promise.all` to handle multiple API requests concurrently
    const updatedSubscriptions = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          // Retrieve subscription details from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.subscription_id);

          // Add the `markedForCancel` field based on `cancel_at_period_end`
          return {
            ...subscription.toObject(), // Convert MongoDB document to plain JS object
            markedForCancel: stripeSubscription.cancel_at_period_end ? true : false,
          };
        } catch (error) {
          console.error(`Error retrieving subscription ${subscription.subscription_id}:`, error.message);
          return {
            ...subscription.toObject(),
            markedForCancel: false, // Default to `false` if there's an error
          };
        }
      })
    );

    return updatedSubscriptions;
  } catch (error) {
    console.error('Error updating subscriptions:', error.message);
    throw error;
  }
};

const getSellerListingSubscriptions = async (req, res) => {
  try {
    const { user, skip, limit } = req;

    const subscriptions = await ListingSubscription.find({ _seller: user._id })
      .skip(skip || 0)
      .limit(limit || 20)
      .populate({ model: "listing", path: "_listing" })
      .populate({ model: "user", path: "_user" })
      .populate({ model: "user", path: "_seller" });
      const mainData= await updateSubscriptionsWithMarkedForCancel(subscriptions);



    res.send({ subscriptions: mainData });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

export default {
  getSellerListings,
  addNewListing,
  updateListing,
  deleteListing,
  getSellerListingSubscriptions,
  getListingByID,
  getSeller,
};
