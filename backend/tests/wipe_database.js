import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import {
  User,
  Interest,
  OrganizationCategory,
  Event,
  Registration,
  Ticket,
  PasswordResetRequest,
} from "../models/index.js";

dotenv.config();

const clearGridFs = async () => {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = new Set(collections.map((entry) => entry.name));
  if (collectionNames.has("fs.files")) {
    await db.collection("fs.files").deleteMany({});
  }
  if (collectionNames.has("fs.chunks")) {
    await db.collection("fs.chunks").deleteMany({});
  }
};

const main = async () => {
  await connectDB();

  const before = {
    users: await User.countDocuments(),
    interests: await Interest.countDocuments(),
    categories: await OrganizationCategory.countDocuments(),
    events: await Event.countDocuments(),
    registrations: await Registration.countDocuments(),
    tickets: await Ticket.countDocuments(),
    passwordResetRequests: await PasswordResetRequest.countDocuments(),
  };

  await Ticket.deleteMany({});
  await Registration.deleteMany({});
  await Event.deleteMany({});
  await PasswordResetRequest.deleteMany({});
  await Interest.deleteMany({});
  await OrganizationCategory.deleteMany({});
  await User.deleteMany({});
  await clearGridFs();

  const after = {
    users: await User.countDocuments(),
    interests: await Interest.countDocuments(),
    categories: await OrganizationCategory.countDocuments(),
    events: await Event.countDocuments(),
    registrations: await Registration.countDocuments(),
    tickets: await Ticket.countDocuments(),
    passwordResetRequests: await PasswordResetRequest.countDocuments(),
  };

  console.log("Full database wipe complete.");
  console.log("Before:", before);
  console.log("After:", after);
};

main()
  .catch((err) => {
    console.error("Failed to wipe database:", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
