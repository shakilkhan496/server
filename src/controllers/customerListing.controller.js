import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
import Listing from "../models/Listing.js";
import ListingSubscription from "../models/ListingSubscription.js";
import { BadRequest, ServerError } from "../utils/errors.js";
import { cancelSubscription, createCheckoutSession, createNewCustomer, getSubscription } from "../config/stripe.js";
import User from "../models/User.js";
import { v4 as uuidv4 } from 'uuid';
import { client } from "./gen.controller.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const upload = multer({ storage: multer.memoryStorage() });



const getListings = async (req, res) => {
  try {
    const { searchKeyword, skip, limit } = req.query;

    const listingFilter = { isDeleted: false, isListed: true };
    if (searchKeyword)
      listingFilter.title = { $regex: new RegExp(searchKeyword, "i") };

    const listings = await Listing.find(listingFilter)
      .populate({
        model: "user",
        path: "_seller",
      })
      .skip(skip || 0)
      .limit(limit || 20);

    res.send({ listings });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const getListingByID = async (req, res) => {
  try {
    const { _listing } = req.params;

    const listing = await Listing.findOne({
      _id: _listing,
      isDeleted: false,
      isListed: true,
    }).populate({
      model: "user",
      path: "_seller",
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

// Controller to get user subscriptions
const getUserSubscriptions = async (req, res) => {
  try {
    const { user } = req;
    const { skip, limit } = req.query;

    // Fetch subscriptions from the database
    const subscriptions = await ListingSubscription.find({ _user: user._id })
      .skip(Number(skip) || 0) // Parse `skip` as a number
      .limit(Number(limit) || 20) // Parse `limit` as a number
      .populate({
        model: "listing",
        path: "_listing",
      })
      .populate({ model: "user", path: "_user" })
      .populate({ model: "user", path: "_seller" });

    // Add `markedForCancel` field to subscriptions
    const mainData = await updateSubscriptionsWithMarkedForCancel(subscriptions);

    // Send the updated subscriptions while keeping the structure intact
    res.send({ subscriptions: mainData });
  } catch (error) {
    ServerError(res, error?.message);
  }
};


const checkoutListing = async (req, res) => {
  try {
    const { _listing, subscriptionType, attachmentUrls, sellerEmail } = req.body;
    const { user } = req;

    const listing = await Listing.findOne({
      _id: _listing,
      isListed: true,
      isDeleted: false,
    });
    if (!listing) return BadRequest(res, "Listing not found!");

    const endDate = new Date();
    const pricing = {
      price: "",
      discount: 0,
      type: subscriptionType,
    };
    if (subscriptionType === "month") {
      endDate.setMonth(endDate.getMonth() + 1);
      pricing.price = listing.monthlyPricing.price;
      pricing.discount = listing.monthlyPricing.discount;
    } else if (subscriptionType === "year") {
      endDate.setFullYear(endDate.getFullYear() + 1);
      pricing.price = listing.yearlyPricing.price;
      pricing.discount = listing.yearlyPricing.discount;
    } else if (subscriptionType === "day") {
      endDate.setDate(endDate.getDate() + 1);
      pricing.price = listing.dailyPricing.price;
      pricing.discount = listing.dailyPricing.discount;
    } else if (subscriptionType === "week") {
      endDate.setDate(endDate.getDate() + 7);
      pricing.price = listing.weeklyPricing.price;
      pricing.discount = listing.weeklyPricing.discount;
    } else return BadRequest(res, "Invalid subscription type!");

    // Create new customer
    const customerInfo = await createNewCustomer(user, listing, pricing);

    // Create checkout session
    const session = await createCheckoutSession(
      listing,
      pricing,
      customerInfo.id,
      attachmentUrls,
      sellerEmail,
      User
    );

    res.send({ session });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const subscribeListing = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const rawBody = req.rawBody || req.body; // Ensure rawBody is a Buffer

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Respond to Stripe immediately to avoid timeouts
    res.status(200).send({ received: true });

    const data = event.data.object;

    const handleCheckoutSessionCompleted = async () => {
      if (data.payment_status === "paid") {
        const session = data;
        const expiredSessionId = session.id;

        const customerEmail = session.customer_details.email;
        const sellerEmail = session.metadata?.sellerEmail;

        await Promise.all([
          User.findOneAndUpdate(
            { email: customerEmail, type: "customer" },
            { $pull: { customer_viewable_packs: { session_id: expiredSessionId } } },
            { new: true }
          ),
          User.findOneAndUpdate(
            { email: sellerEmail, type: "seller" },
            { $pull: { requested_pack: { session_id: expiredSessionId } } },
            { new: true }
          ),
        ]);
        console.log("Successfully updated customer and seller records.");
      }
    };

    const handleInvoicePaymentSucceeded = async () => {
      try {
        const invoice = data;
        const subscriptionId = invoice.subscription;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const { _listing, _user, subscriptionType } = customer.metadata;

        const [listing, user] = await Promise.all([
          Listing.findOne({ _id: _listing, isListed: true, isDeleted: false }),
          User.findOne({ _id: _user }),
        ]);

        if (!listing || !user) throw new Error("Listing or User not found!");

        const existingSubscription = await ListingSubscription.findOne({
          _listing,
          _user: user._id,
          endDate: { $gt: new Date() },
        });

        if (existingSubscription) {
          console.log("Listing already subscribed.");
          return;
        }

        const endDate = new Date();
        if (subscriptionType === "month") endDate.setMonth(endDate.getMonth() + 1);
        else if (subscriptionType === "year") endDate.setFullYear(endDate.getFullYear() + 1);
        else if (subscriptionType === "week") endDate.setDate(endDate.getDate() + 7);
        else if (subscriptionType === "day") endDate.setDate(endDate.getDate() + 1);
        else throw new Error("Invalid subscription type!");

        const newSubscription = new ListingSubscription({
          subscriptionType,
          subscription_id: subscriptionId,
          _listing: listing._id,
          billingID: customer.id,
          _seller: listing._seller,
          _user: user._id,
          startDate: new Date(),
          endDate,
        });

        await newSubscription.save();
        console.log("Successfully created a new subscription.");
      } catch (err) {
        console.error("Error in invoice.payment_succeeded:", err);
      }
    };

    const handleInvoicePaymentFailed = async () => {
      try {
        const invoice = data;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const { _listing, _user } = customer.metadata;

        const [listing, user] = await Promise.all([
          Listing.findOne({ _id: _listing, isListed: true, isDeleted: false }),
          User.findOne({ _id: _user }),
        ]);

        if (!listing || !user) throw new Error("Listing or User not found!");

        const subscription = await ListingSubscription.findOneAndDelete({
          _listing,
          _user: user._id,
        });

        if (!subscription) {
          console.log("No active subscription to delete.");
          return;
        }

        console.log("Subscription and listing updated after payment failure.");
      } catch (err) {
        console.error("Error in invoice.payment_failed:", err);
      }
    };

    const handleCustomerSubscriptionDeleted = async () => {
      try {
        const subscription = data;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const { _listing, _user } = customer.metadata;

        const [listing, user] = await Promise.all([
          Listing.findOne({ _id: _listing, isListed: true, isDeleted: false }),
          User.findOne({ _id: _user }),
        ]);

        if (!listing || !user) throw new Error("Listing or User not found!");

        await ListingSubscription.findOneAndDelete({
          _listing,
          _user: user._id,
        });

        console.log("Subscription deleted and listing updated.");
      } catch (err) {
        console.error("Error in customer.subscription.deleted:", err);
      }
    };

    const handleCheckoutSessionExpired = async () => {
      try {
        const session = data;
        const expiredSessionId = session.id;

        const customerEmail = session.customer_details.email;
        const sellerEmail = session.metadata?.sellerEmail;

        await Promise.all([
          User.findOneAndUpdate(
            { email: customerEmail, type: "customer" },
            { $pull: { customer_viewable_packs: { session_id: expiredSessionId } } },
            { new: true }
          ),
          User.findOneAndUpdate(
            { email: sellerEmail, type: "seller" },
            { $pull: { requested_pack: { session_id: expiredSessionId } } },
            { new: true }
          ),
        ]);
        console.log("Successfully handled expired checkout session.");
      } catch (err) {
        console.error("Error in checkout.session.expired:", err);
      }
    };

    const eventHandlers = {
      "checkout.session.completed": handleCheckoutSessionCompleted,
      "invoice.payment_succeeded": handleInvoicePaymentSucceeded,
      "invoice.payment_failed": handleInvoicePaymentFailed,
      "customer.subscription.deleted": handleCustomerSubscriptionDeleted,
      "checkout.session.expired": handleCheckoutSessionExpired,
    };

    if (eventHandlers[event.type]) {
      await eventHandlers[event.type]();
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Error in subscribeListing handler:", err);
  }
};

const renewSubscription = async (req, res) => {
  try {
    const { user } = req;
    const { _subscription, subscriptionType } = req.body;

    const subscription = await ListingSubscription.findOne({
      _id: _subscription,
      _user: user._id,
    });
    if (!subscription) return BadRequest(res, "Subscription not found!");

    let endDate = new Date();

    if (subscriptionType === "monthly")
      endDate.setMonth(endDate.getMonth() + 1);
    else if (subscriptionType === "yearly")
      endDate.setFullYear(endDate.getFullYear() + 1);
    else if (subscriptionType === "daily")
      endDate.setDate(endDate.getDate() + 1);
    else if (subscriptionType === "weekly")
      endDate.setDate(endDate.getDate() + 7);
    else return BadRequest(res, "Invalid subscription type!");

    const renewedSubscription = await ListingSubscription.findByIdAndUpdate(
      _subscription,
      { endDate },
      { new: true }
    )
      .populate({
        model: "listing",
        model: "_listing",
      })
      .populate({
        model: "user",
        model: "_user",
      })
      .populate({
        model: "user",
        model: "_seller",
      });

    res.send({
      status: "success",
      message: "Subscription renewed successfully",
      subscription: renewedSubscription,
    });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const uploadAttachment = async (req, res) => {
  try {
    const file = req.file;
    console.log({file})
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileExtension = file.originalname.split(".").pop();
    const s3Key = `attachments/${uuidv4()}.${fileExtension}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await client.send(command);

    const url = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    res.json({ url });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
};

const cancelSubscriptionAPI = async (req, res) => {
  try{
    const response = await cancelSubscription(
      req.body.subscription_id, req.body.isCancel
    )
    if (response){
      res.send(true)
    }
  }catch(error){
    console.error("Error cancelling subscription:", error.message);
    res.send(false)
  }
}

const getSubscriptionAPI = async (req, res) => {
  try{
    const response = await getSubscription(
      req.body.subscription_id
    )
    if (response){
      res.send(response)
    }
  }catch(error){
    console.error("Error cancelling subscription:", error.message);
    res.send(false)
  }
}


export default {
  getListings,
  subscribeListing,
  getUserSubscriptions,
  renewSubscription,
  getListingByID,
  checkoutListing,
  uploadAttachment,
  cancelSubscriptionAPI,
  getSubscriptionAPI,
  

};
