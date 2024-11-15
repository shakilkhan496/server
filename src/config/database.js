import mongoose from "mongoose";
import { Lucia, TimeSpan } from "lucia";
import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
import dotenv from "dotenv";
dotenv.config();

const connectToDatabase = async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(process.env.DB_URI);
    console.log("Connected to database");
  } catch (error) {
    console.log("Unable to connect to database!");
  }
};

connectToDatabase();

export const adapter = new MongodbAdapter(
  mongoose.connection.collection("usersessions"),
  mongoose.connection.collection("users")
);

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(2, "w"),
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
});
