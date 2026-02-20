// backend/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { errors } from "../utils/Errors.js";

export const protect = async (req, res, next) => {
  let token;
  
  // Check cookie or Authorization header
  if (req.cookies?.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(errors.unauthorized("Please log in to access this resource"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      _id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    };
    return next();
  } catch (err) {
    return next(errors.unauthorized("Invalid or expired token"));
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(errors.forbidden("You do not have permission"));
    }
    next();
  };
};
