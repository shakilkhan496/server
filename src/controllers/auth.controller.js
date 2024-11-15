import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";
import { v4 as uuidv4 } from "uuid";
import UserSession from "../models/UserSession.js";
import {
  BadRequest,
  ServerError,
  UnauthorizedRequest,
} from "../utils/errors.js";
import { clearAllCookies, cookieOptions } from "../utils/cookies.js";
import { lucia } from "../config/database.js";

dotenv.config();

const registerSeller = async (req, res) => {
  try {
    const { email, password, name, type } = req.body;

    const userAlreadyExists = await User.findOne({ email, type: "seller" });
    if (userAlreadyExists)
      return BadRequest(res, "User already exists with given email!");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newSeller = new User({
      email,
      password: hashedPassword,
      name,
      type: "seller",
    });

    await newSeller.save();

    return res.status(201).send({
      status: "success",
      message: "Seller Account created successfully!",
    });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (!userExists) return BadRequest(res, "Login failed!");

    const isPasswordMatch = await bcrypt.compare(password, userExists.password);
    if (!isPasswordMatch) return UnauthorizedRequest(res, "Login failed!");

    // Create a session
    const session = await lucia.createSession(userExists._id, {});
    const sessionCookie = lucia.createSessionCookie(session.id).serialize();

    res.cookie(process.env.LOGIN_COOKIE, sessionCookie, cookieOptions);

    res.send({
      status: "success",
      message: "Login successful",
      user: userExists,
    });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const logout = async (req, res) => {
  try {
    let sessionCookie = req.cookies[process.env.LOGIN_COOKIE];

    if (sessionCookie) {
      const sessionId = lucia.readSessionCookie(sessionCookie ?? "");

      let { session, user } = await lucia.validateSession(sessionId);
      if (!session || !user)
        return res.status(401).send({ message: "Unauthorized" });

      // Delete Session from database
      await UserSession.findByIdAndDelete(sessionId);

      await lucia.invalidateSession(sessionId);
    }

    clearAllCookies(req, res);

    res.send({ message: "Logout successful!" });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

const registerCustomer = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const userAlreadyExists = await User.findOne({ email, type: "customer" });
    if (userAlreadyExists)
      return BadRequest(res, "User already exists with given email!");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newSeller = new User({
      email,
      password: hashedPassword,
      name,
      type: "customer",
    });

    await newSeller.save();

    return res.status(201).send({
      status: "success",
      message: "User registered successfully",
    });
  } catch (error) {
    ServerError(res, error?.message);
  }
};

export default { registerSeller, login, logout, registerCustomer };
