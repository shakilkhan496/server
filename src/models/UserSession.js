import mongoose from "mongoose";

const UserSessionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const UserSession = mongoose.model("userSession", UserSessionSchema);

export default UserSession;
