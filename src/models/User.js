import mongoose from "mongoose";

const RequestedPackSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    item_name: {
      type: String,
      required: false,
    },
    session_id: {
      type: String,
      required: false,
    },
    fileUrl: {
      type: [String], // Changed to array of strings
      required: true,
      validate: {
        validator: function (urls) {
          return urls.length <= 5;
        },
        message: 'You can only upload a maximum of 5 files.',
      },
    },
    permission: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    checkoutURL: {
      type: String,
      required: true,
    },
    listing_id: {
      type: String,
      required: true,
    },
  },
  { _id: false } // No _id for subdocuments
);


const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    // Visible only to the seller to manage requests
    requested_pack: {
      type: [RequestedPackSchema],
      required: false,
    },
    // A duplicate of `requested_pack` for customers to view offers
    customer_viewable_packs: {
      type: [RequestedPackSchema],
      required: false,
    },
    users: {
      type: Array,
      required: false,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["seller", "customer"],
      required: true,
    },
  },
  { timestamps: true }
);

// Remove sensitive data when returning the user object
UserSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model("user", UserSchema);

export default User;
