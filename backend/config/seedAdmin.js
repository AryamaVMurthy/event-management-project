import bcrypt from "bcryptjs";
import { Admin } from "../models/User.js";
import { env } from "./env.js";

export const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existing = await Admin.findOne({ email: env.ADMIN_EMAIL });
    if (existing) {
      console.log("Admin already exists");
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    await Admin.create({
      email: env.ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
    });
    console.log("Admin account created successfully");
  } catch (err) {
    console.error("Failed to seed admin:", err.message);
  }
};
