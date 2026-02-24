// Auth Controller: Controller level logic for the feature area.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";

import {
  User,
  IIITParticipant,
  NonIIITParticipant,
  Organizer,
} from "../models/User.js"; 
import { participantZodSchema, loginSchema } from "../models/User.js";

// Sign Token: Creates a signed JWT that includes identity and role claims. Inputs: user. Returns: a function result.
const signToken = (user) => {
  const userId = (user.id ?? user._id)?.toString();
  return jwt.sign(
    { id: userId, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

// Is Secure Frontend Origin: Checks whether the configured frontend URL is HTTPS so cookies can be marked secure. Inputs: (. Returns: a function result.
const isSecureFrontendOrigin = (() => {
  try {
    return new URL(env.FRONTEND_URL).protocol === "https:";
  } catch {
    return false;
  }
})();

const cookieOptions = {
  httpOnly: true,
  secure: isSecureFrontendOrigin,
  sameSite: isSecureFrontendOrigin ? "none" : "lax",
  path: "/",
  maxAge: 14 * 24 * 60 * 60 * 1000,
};

// Set Auth Cookie: Writes the authentication cookie to the response using shared cookie defaults. Inputs: res, token. Returns: side effects and response to caller.
const setAuthCookie = (res, token) => {
  res.cookie("token", token, cookieOptions);
};

// Register: Registers a new account and signs the user in on success. Inputs: req, res, next. Returns: side effects and response to caller.
const register = async (req, res, next) => {
  try {
    const payload = participantZodSchema.parse(req.body);

    const existing = await User.findOne({ email: payload.email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashed = await bcrypt.hash(payload.password, 10);
    payload.password = hashed;

    const Model = payload.participantType === "IIIT_PARTICIPANT" 
      ? IIITParticipant 
      : NonIIITParticipant;

    const newUser = await Model.create(payload);

    const token = signToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    return next(err);
  }
};

// Login: Authenticates a user and establishes a session through a response cookie. Inputs: req, res, next. Returns: side effects and response to caller.
const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email }).select("+password");
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.role === "organizer") {
      const organizer = await Organizer.findById(user._id).select("accountStatus");
      if (!organizer || organizer.accountStatus !== "ACTIVE") {
        return res.status(403).json({
          message: "Organizer account is not active. Contact admin.",
        });
      }
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    return next(err);
  }
};

// Logout: Clears the auth cookie and resets client session state. Inputs: req, res. Returns: side effects and response to caller.
const logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  return res.status(200).json({ message: "Logout successful" });
};

export { register, login, logout };
