import dotenv from "dotenv";
dotenv.config();
import { cookieOptions } from "../utils/cookies.js";
import { lucia } from "../config/database.js";
import User from "../models/User.js";

export const authenticateAccess = async (req, res, next) => {
  let sessionCookie = req.cookies[process.env.LOGIN_COOKIE];
  if (!sessionCookie) return res.status(401).send({ message: "Unauthorized" });
  const sessionId = lucia.readSessionCookie(sessionCookie ?? "");
  let { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user)
    return res.status(401).send({ message: "Unauthorized" });
  if (session.fresh)
    res.cookie(
      process.env.LOGIN_COOKIE,
      lucia.createSessionCookie(session.id).serialize(),
      cookieOptions
    );
  // Get Complete User Data
  user = await User.findById(user.id);
  delete user.password;
  req.user = user;
  next();
};
