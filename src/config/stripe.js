import stripe from "stripe";

const Stripe = stripe(process.env.STRIPE_SECRET_KEY);

export async function updateOfferForSellerAndCustomer(User, sellerEmail, customerEmail, checkoutUrl, attachmentUrls,item_name,session_id,listing_id) {
  try {
    const offerDetails = {
      email: customerEmail,
      fileUrl: attachmentUrls,
      permission: "pending",
      checkoutURL: checkoutUrl,
      item_name,
      session_id,
      listing_id
    };

    // Update the seller's `requested_pack` array
    const sellerUpdate = await User.findOneAndUpdate(
      { email: sellerEmail, type: "seller" },
      { $push: { requested_pack: offerDetails } },
      { new: true }
    );

    if (!sellerUpdate) {
      throw new Error("Seller not found or not a seller account");
    }

    // Update the customer's `customer_viewable_packs` array
    const customerUpdate = await User.findOneAndUpdate(
      { email: customerEmail, type: "customer" },
      { $push: { customer_viewable_packs: offerDetails } },
      { new: true }
    );

    if (!customerUpdate) {
      throw new Error("Customer not found or not a customer account");
    }

    return {
      sellerData: sellerUpdate,
      customerData: customerUpdate,
    };
  } catch (error) {
    console.error("Error updating offer for seller and customer:", error);
    throw new Error("Failed to update offer data.");
  }
}

export const createCheckoutSession = async (listing, pricing, customerID, attachmentUrls, sellerEmail, User) => {
  const customer = await Stripe.customers.retrieve(customerID);
  console.log(listing._id.toString());


  let customerEmail;
  customerEmail = customer.email;
  console.log("Customer email:", customerEmail, attachmentUrls, sellerEmail);
  const session = await Stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerID,
    subscription_data:{
      metadata:{
        sellerEmail: sellerEmail,
      }
    },
    metadata:{
      sellerEmail: sellerEmail,
      listingId: listing._id.toString(),
    },
    line_items: [
      {
        price_data: {
          currency: process.env.STRIPE_CURRENCY,
          product_data: {
            name: listing.title,
          },
          recurring: {
            interval: pricing.type, // e.g., 'month' or 'year'
          },
          unit_amount: Math.round((pricing.price - pricing.discount) * 100),
        },
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    success_url: `${process.env.FRONTEND_APP_URL}/subscriptions?message=Payment%20successful`,
    cancel_url: `${process.env.FRONTEND_APP_URL}/requestedPack`,
  });
  // console.log(session)
 
  

  const finalUpdate = await updateOfferForSellerAndCustomer(User, sellerEmail, customerEmail, session.url, attachmentUrls, listing.title, session.id, listing._id.toString());

 console.log("Final update:", finalUpdate);

  return finalUpdate;
};

export const createBillingSession = async user => {
  const session = await Stripe.billingPortal.sessions.create({
    customer: user._id.toString(),
    return_url: process.env.FRONTEND_APP_URL,
  });

  return session;
};

export const getCustomerID = async user => {
  const customer = await Stripe.customers.list({
    email: user.email,
  });

  return customer.data[0].id;
};

export const createNewCustomer = async (user, listing, pricing) => {
  const customer = await Stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      _user: user._id.toString(),
      _listing: listing._id.toString(),
      subscriptionType: pricing.type,
    },
  });

  return customer;
};

export const cancelSubscription = async (subscriptionID, isCancel) => {
  const subscription = await Stripe.subscriptions.update(
    subscriptionID,
    {
      cancel_at_period_end:isCancel ? false : true,
    }
  );
  if (subscription){
    return true;
  }
}
export const renewSubscription = async ( subscriptionID) => {
  const subscription = await Stripe.subscriptions.update(
    subscriptionID,
    {
      cancel_at_period_end:false,
    }
  );
  if (subscription.cancel_at_period_end === false){
    return true;
  }
}
export const getSubscription = async ( subscriptionID) => {
  const subscription = await Stripe.subscriptions.update(
    subscriptionID
  );
  return subscription;
}
