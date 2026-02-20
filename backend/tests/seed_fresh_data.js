import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import {
  Admin,
  User,
  Interest,
  OrganizationCategory,
  Organizer,
  IIITParticipant,
  NonIIITParticipant,
  Event,
  Registration,
  Ticket,
  PasswordResetRequest,
} from "../models/index.js";

dotenv.config();

const daysFromNow = (days) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value;
};

const createTicketForRegistration = async (registration, seq) => {
  const ticketId = `FRESH-TKT-${seq}-${Date.now()}`;
  return Ticket.create({
    ticketId,
    registrationId: registration._id,
    participantId: registration.participantId,
    eventId: registration.eventId,
    qrPayload: {
      ticketId,
      registrationId: String(registration._id),
      participantId: String(registration.participantId),
      eventId: String(registration.eventId),
    },
  });
};

const clearNonAdminData = async () => {
  await Ticket.deleteMany({});
  await Registration.deleteMany({});
  await Event.deleteMany({});
  await PasswordResetRequest.deleteMany({});
  await Interest.deleteMany({});
  await OrganizationCategory.deleteMany({});
  await User.deleteMany({ role: { $ne: "admin" } });
};

const main = async () => {
  await connectDB();

  const admin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  if (!admin) {
    throw new Error(
      "Admin user not found. Start backend once (`npm start`) so auto-seed can create admin."
    );
  }

  await clearNonAdminData();

  const interests = await Interest.insertMany([
    { name: "Coding", description: "Competitive programming and software projects", isActive: true },
    { name: "Robotics", description: "Bots, control systems, and embedded hardware", isActive: true },
    { name: "Literature", description: "Poetry, prose, and spoken-word events", isActive: true },
    { name: "Music", description: "Bands, vocals, and instrumental performances", isActive: true },
    { name: "Art", description: "Sketching, design, and visual creativity", isActive: true },
    { name: "Gaming", description: "Esports and strategy game tournaments", isActive: true },
    { name: "Entrepreneurship", description: "Startup and innovation challenges", isActive: true },
    { name: "Design", description: "UI/UX and product design work", isActive: true },
  ]);

  const interestByName = new Map(interests.map((entry) => [entry.name, entry]));

  const categories = await OrganizationCategory.insertMany([
    { name: "Technical", description: "Technical clubs and councils" },
    { name: "Cultural", description: "Cultural clubs and performing groups" },
    { name: "Management", description: "Management and operations teams" },
  ]);
  const categoryByName = new Map(categories.map((entry) => [entry.name, entry]));

  const organizerSeeds = [
    {
      email: "codecraft@clubs.iiit.ac.in",
      password: "123456",
      organizerName: "CodeCraft Club",
      categoryName: "Technical",
      description: "Programming, DSA, and software engineering events",
      contactNumber: "9000000010",
      accountStatus: "ACTIVE",
    },
    {
      email: "mechminds@clubs.iiit.ac.in",
      password: "123456",
      organizerName: "MechMinds",
      categoryName: "Technical",
      description: "Robotics and hardware build competitions",
      contactNumber: "9000000011",
      accountStatus: "ACTIVE",
    },
    {
      email: "rhythmhouse@clubs.iiit.ac.in",
      password: "123456",
      organizerName: "Rhythm House",
      categoryName: "Cultural",
      description: "Music and performance events",
      contactNumber: "9000000012",
      accountStatus: "ACTIVE",
    },
    {
      email: "pixelforge@clubs.iiit.ac.in",
      password: "123456",
      organizerName: "Pixel Forge",
      categoryName: "Cultural",
      description: "Art and design exhibits",
      contactNumber: "9000000013",
      accountStatus: "ACTIVE",
    },
    {
      email: "disabled.club@clubs.iiit.ac.in",
      password: "123456",
      organizerName: "Disabled Club",
      categoryName: "Management",
      description: "Disabled organizer scenario",
      contactNumber: "9000000014",
      accountStatus: "DISABLED",
      disabledAt: daysFromNow(-2),
      statusReason: "Policy violation under review",
    },
    {
      email: "archived.club@clubs.iiit.ac.in",
      password: "123456",
      organizerName: "Archived Club",
      categoryName: "Management",
      description: "Archived organizer scenario",
      contactNumber: "9000000015",
      accountStatus: "ARCHIVED",
      archivedAt: daysFromNow(-20),
      statusReason: "Club no longer active",
    },
  ];

  const organizers = [];
  for (const organizerSeed of organizerSeeds) {
    const hashed = await bcrypt.hash(organizerSeed.password, 10);
    const organizer = await Organizer.create({
      email: organizerSeed.email,
      password: hashed,
      organizerName: organizerSeed.organizerName,
      category: categoryByName.get(organizerSeed.categoryName)._id,
      description: organizerSeed.description,
      contactNumber: organizerSeed.contactNumber,
      accountStatus: organizerSeed.accountStatus,
      disabledAt: organizerSeed.disabledAt || null,
      archivedAt: organizerSeed.archivedAt || null,
      statusReason: organizerSeed.statusReason || "",
    });
    organizers.push(organizer);
  }

  const organizerByEmail = new Map(organizers.map((entry) => [entry.email, entry]));

  const p1 = await IIITParticipant.create({
    email: "iiit.alpha@iiit.ac.in",
    password: await bcrypt.hash("password123", 10),
    firstName: "Aarav",
    lastName: "Iyer",
    contactNumber: "8000000101",
    collegeOrgName: "IIIT Hyderabad",
    batch: "UG3",
    interests: [interestByName.get("Coding")._id, interestByName.get("Robotics")._id],
    followedClubs: [
      organizerByEmail.get("codecraft@clubs.iiit.ac.in")._id,
      organizerByEmail.get("mechminds@clubs.iiit.ac.in")._id,
    ],
  });

  const p2 = await IIITParticipant.create({
    email: "iiit.beta@iiit.ac.in",
    password: await bcrypt.hash("password123", 10),
    firstName: "Nisha",
    lastName: "Rao",
    contactNumber: "8000000102",
    collegeOrgName: "IIIT Hyderabad",
    batch: "UG2",
    interests: [interestByName.get("Literature")._id, interestByName.get("Design")._id],
    followedClubs: [organizerByEmail.get("pixelforge@clubs.iiit.ac.in")._id],
  });

  const p3 = await NonIIITParticipant.create({
    email: "external.gamma@gmail.com",
    password: await bcrypt.hash("password123", 10),
    firstName: "Riya",
    lastName: "Sharma",
    contactNumber: "8000000103",
    collegeOrgName: "NIT Trichy",
    interests: [interestByName.get("Music")._id, interestByName.get("Art")._id],
    followedClubs: [organizerByEmail.get("rhythmhouse@clubs.iiit.ac.in")._id],
  });

  const p4 = await NonIIITParticipant.create({
    email: "external.delta@gmail.com",
    password: await bcrypt.hash("password123", 10),
    firstName: "Karan",
    lastName: "Mehta",
    contactNumber: "8000000104",
    collegeOrgName: "VIT Chennai",
    interests: [interestByName.get("Entrepreneurship")._id, interestByName.get("Gaming")._id],
    followedClubs: [],
  });

  const events = {};
  events.publishedCoding = await Event.create({
    name: "CodeStorm Challenge",
    description: "High-intensity coding challenge for all participants",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(4),
    startDate: daysFromNow(6),
    endDate: daysFromNow(6),
    registrationLimit: 200,
    registrationFee: 0,
    organizerId: organizerByEmail.get("codecraft@clubs.iiit.ac.in")._id,
    status: "PUBLISHED",
    tags: ["coding", "algorithms", "contest", "fresh-seed"],
    customFormSchema: [
      { id: "exp", type: "text", label: "Coding experience", required: true, options: [], order: 0 },
      {
        id: "lang",
        type: "dropdown",
        label: "Primary language",
        required: true,
        options: ["C++", "Java", "Python"],
        order: 1,
      },
    ],
    items: [],
  });

  events.publishedIiitOnly = await Event.create({
    name: "IIIT Systems Hack",
    description: "Internal systems hack for IIIT participants",
    type: "NORMAL",
    eligibility: "IIIT_ONLY",
    registrationDeadline: daysFromNow(7),
    startDate: daysFromNow(9),
    endDate: daysFromNow(9),
    registrationLimit: 120,
    registrationFee: 0,
    organizerId: organizerByEmail.get("mechminds@clubs.iiit.ac.in")._id,
    status: "PUBLISHED",
    tags: ["robotics", "hardware", "iiit", "fresh-seed"],
    customFormSchema: [
      {
        id: "domain",
        type: "checkbox",
        label: "Preferred domain",
        required: true,
        options: ["Embedded", "Controls", "Computer Vision"],
        order: 0,
      },
    ],
    items: [],
  });

  events.publishedNonIiitOnly = await Event.create({
    name: "Open Innovation Sprint",
    description: "External participant innovation sprint",
    type: "NORMAL",
    eligibility: "NON_IIIT_ONLY",
    registrationDeadline: daysFromNow(6),
    startDate: daysFromNow(8),
    endDate: daysFromNow(8),
    registrationLimit: 100,
    registrationFee: 50,
    organizerId: organizerByEmail.get("codecraft@clubs.iiit.ac.in")._id,
    status: "PUBLISHED",
    tags: ["entrepreneurship", "innovation", "startup", "fresh-seed"],
    customFormSchema: [
      { id: "idea", type: "text", label: "Startup idea summary", required: true, options: [], order: 0 },
    ],
    items: [],
  });

  events.ongoingRobotics = await Event.create({
    name: "Robo Arena Live",
    description: "Live robotics challenge currently running",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-1),
    startDate: daysFromNow(0),
    endDate: daysFromNow(1),
    registrationLimit: 80,
    registrationFee: 0,
    organizerId: organizerByEmail.get("mechminds@clubs.iiit.ac.in")._id,
    status: "ONGOING",
    tags: ["robotics", "arena", "live", "fresh-seed"],
    customFormSchema: [
      { id: "bot", type: "text", label: "Bot category", required: true, options: [], order: 0 },
    ],
    items: [],
  });

  events.closedLiterature = await Event.create({
    name: "LitSpeak Semi-Finals",
    description: "Closed registrations for literature semi-finals",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-5),
    startDate: daysFromNow(-3),
    endDate: daysFromNow(-3),
    registrationLimit: 60,
    registrationFee: 0,
    organizerId: organizerByEmail.get("pixelforge@clubs.iiit.ac.in")._id,
    status: "CLOSED",
    tags: ["literature", "debate", "spoken-word", "fresh-seed"],
    customFormSchema: [
      {
        id: "topic",
        type: "dropdown",
        label: "Preferred topic",
        required: true,
        options: ["Tech", "Society", "Policy"],
        order: 0,
      },
    ],
    items: [],
  });

  events.completedNormal = await Event.create({
    name: "Design Duel Finals",
    description: "Completed design competition finals",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-20),
    startDate: daysFromNow(-18),
    endDate: daysFromNow(-18),
    registrationLimit: 90,
    registrationFee: 0,
    organizerId: organizerByEmail.get("pixelforge@clubs.iiit.ac.in")._id,
    status: "COMPLETED",
    tags: ["design", "art", "visual", "fresh-seed"],
    customFormSchema: [
      { id: "tool", type: "text", label: "Design tool used", required: true, options: [], order: 0 },
    ],
    items: [],
  });

  events.draftNormal = await Event.create({
    name: "Game Theory Workshop",
    description: "Draft workshop not visible to participants",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(10),
    startDate: daysFromNow(12),
    endDate: daysFromNow(12),
    registrationLimit: 70,
    registrationFee: 0,
    organizerId: organizerByEmail.get("codecraft@clubs.iiit.ac.in")._id,
    status: "DRAFT",
    tags: ["gaming", "theory", "draft", "fresh-seed"],
    customFormSchema: [
      { id: "motivation", type: "text", label: "Why attend?", required: false, options: [], order: 0 },
    ],
    items: [],
  });

  events.publishedMerch = await Event.create({
    name: "Felicity Merch Drop",
    description: "Official hoodies and tees",
    type: "MERCHANDISE",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(5),
    startDate: daysFromNow(6),
    endDate: daysFromNow(15),
    registrationLimit: 500,
    registrationFee: 0,
    organizerId: organizerByEmail.get("rhythmhouse@clubs.iiit.ac.in")._id,
    status: "PUBLISHED",
    tags: ["merch", "music", "fresh-seed"],
    customFormSchema: [],
    items: [
      {
        itemId: "hoodie-001",
        name: "Felicity Hoodie",
        description: "Black hoodie with event logo",
        purchaseLimitPerParticipant: 2,
        variants: [
          { variantId: "hoodie-s-black", size: "S", color: "Black", label: "S / Black", price: 999, stockQty: 15 },
          { variantId: "hoodie-m-black", size: "M", color: "Black", label: "M / Black", price: 999, stockQty: 10 },
        ],
      },
      {
        itemId: "tee-002",
        name: "Felicity Tee",
        description: "White tee with print",
        purchaseLimitPerParticipant: 3,
        variants: [
          { variantId: "tee-s-white", size: "S", color: "White", label: "S / White", price: 499, stockQty: 25 },
        ],
      },
    ],
  });

  events.completedMerch = await Event.create({
    name: "Winter Merch Archive",
    description: "Completed historical merch campaign",
    type: "MERCHANDISE",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-60),
    startDate: daysFromNow(-58),
    endDate: daysFromNow(-50),
    registrationLimit: 300,
    registrationFee: 0,
    organizerId: organizerByEmail.get("rhythmhouse@clubs.iiit.ac.in")._id,
    status: "COMPLETED",
    tags: ["merch", "archive", "fresh-seed"],
    customFormSchema: [],
    items: [
      {
        itemId: "cap-001",
        name: "Winter Cap",
        description: "Archived cap item",
        purchaseLimitPerParticipant: 1,
        variants: [
          { variantId: "cap-std", size: "STD", color: "Black", label: "Standard", price: 299, stockQty: 0 },
        ],
      },
    ],
  });

  const registrations = [];
  registrations.push(
    await Registration.create({
      participantId: p1._id,
      eventId: events.publishedCoding._id,
      status: "REGISTERED",
      teamName: "Code Cyclones",
      responses: { exp: "3 years CP", lang: "C++" },
    })
  );
  registrations.push(
    await Registration.create({
      participantId: p1._id,
      eventId: events.completedNormal._id,
      status: "COMPLETED",
      responses: { tool: "Figma" },
      attended: true,
      attendedAt: daysFromNow(-18),
      attendanceMarkedBy: organizerByEmail.get("pixelforge@clubs.iiit.ac.in")._id,
    })
  );
  registrations.push(
    await Registration.create({
      participantId: p1._id,
      eventId: events.closedLiterature._id,
      status: "CANCELLED",
      responses: { topic: "Tech" },
    })
  );
  registrations.push(
    await Registration.create({
      participantId: p2._id,
      eventId: events.ongoingRobotics._id,
      status: "REGISTERED",
      teamName: "Bot Builders",
      responses: { bot: "Maze Runner" },
    })
  );
  registrations.push(
    await Registration.create({
      participantId: p3._id,
      eventId: events.publishedNonIiitOnly._id,
      status: "REGISTERED",
      responses: { idea: "Circular economy logistics platform" },
    })
  );
  registrations.push(
    await Registration.create({
      participantId: p3._id,
      eventId: events.publishedMerch._id,
      status: "REGISTERED",
      merchPurchase: {
        itemId: "hoodie-001",
        variantId: "hoodie-s-black",
        quantity: 1,
        unitPrice: 999,
        totalAmount: 999,
      },
    })
  );
  registrations.push(
    await Registration.create({
      participantId: p4._id,
      eventId: events.completedNormal._id,
      status: "REJECTED",
      responses: { tool: "Canva" },
    })
  );

  let ticketSeq = 1;
  for (const registration of registrations) {
    if (registration.status === "REGISTERED" || registration.status === "COMPLETED") {
      await createTicketForRegistration(registration, ticketSeq);
      ticketSeq += 1;
    }
  }

  await PasswordResetRequest.insertMany([
    {
      organizerId: organizerByEmail.get("disabled.club@clubs.iiit.ac.in")._id,
      requestedAt: daysFromNow(-3),
      reason: "Forgot credentials after account suspension",
      status: "PENDING",
    },
    {
      organizerId: organizerByEmail.get("archived.club@clubs.iiit.ac.in")._id,
      requestedAt: daysFromNow(-10),
      reason: "Need temporary access for archive export",
      status: "APPROVED",
      reviewedBy: admin._id,
      reviewedAt: daysFromNow(-9),
      adminComment: "Approved for one-time export",
      generatedTempPasswordHash: await bcrypt.hash("654321", 10),
    },
    {
      organizerId: organizerByEmail.get("archived.club@clubs.iiit.ac.in")._id,
      requestedAt: daysFromNow(-6),
      reason: "Second reset request",
      status: "REJECTED",
      reviewedBy: admin._id,
      reviewedAt: daysFromNow(-5),
      adminComment: "Rejected due to duplicate request",
    },
  ]);

  const counts = {
    users: await User.countDocuments(),
    admins: await User.countDocuments({ role: "admin" }),
    organizers: await Organizer.countDocuments(),
    participants: await User.countDocuments({
      role: { $in: ["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"] },
    }),
    interests: await Interest.countDocuments(),
    categories: await OrganizationCategory.countDocuments(),
    events: await Event.countDocuments(),
    registrations: await Registration.countDocuments(),
    tickets: await Ticket.countDocuments(),
    passwordResetRequests: await PasswordResetRequest.countDocuments(),
  };

  console.log("\nFresh comprehensive seed completed.");
  console.log("\nCredentials:");
  console.log("Admin:", process.env.ADMIN_EMAIL, "/", process.env.ADMIN_PASSWORD);
  console.log("Organizer (ACTIVE): codecraft@clubs.iiit.ac.in / 123456");
  console.log("Organizer (ACTIVE): mechminds@clubs.iiit.ac.in / 123456");
  console.log("Organizer (ACTIVE): rhythmhouse@clubs.iiit.ac.in / 123456");
  console.log("Organizer (ACTIVE): pixelforge@clubs.iiit.ac.in / 123456");
  console.log("Organizer (DISABLED): disabled.club@clubs.iiit.ac.in / 123456");
  console.log("Organizer (ARCHIVED): archived.club@clubs.iiit.ac.in / 123456");
  console.log("Participant (IIIT): iiit.alpha@iiit.ac.in / password123");
  console.log("Participant (IIIT): iiit.beta@iiit.ac.in / password123");
  console.log("Participant (External): external.gamma@gmail.com / password123");
  console.log("Participant (External): external.delta@gmail.com / password123");
  console.log("\nCounts:", counts);
};

main()
  .catch((err) => {
    console.error("Failed to seed fresh data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
