import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import {
  User,
  Interest,
  OrganizationCategory,
  Organizer,
  IIITParticipant,
  NonIIITParticipant,
} from "../models/User.js";
import { Event } from "../models/Event.js";
import { Registration } from "../models/Registration.js";
import { Ticket } from "../models/Ticket.js";

dotenv.config();

const DEMO_ORGANIZERS = [
  {
    email: "litclub@clubs.iiit.ac.in",
    password: "123456",
    organizerName: "Lit Club",
    categoryName: "Cultural",
    description: "Literary and spoken-word events",
    contactNumber: "9000000001",
  },
  {
    email: "roboclub@clubs.iiit.ac.in",
    password: "123456",
    organizerName: "Robo Club",
    categoryName: "Technical",
    description: "Robotics and build challenges",
    contactNumber: "9000000002",
  },
  {
    email: "musicclub@clubs.iiit.ac.in",
    password: "123456",
    organizerName: "Music Club",
    categoryName: "Cultural",
    description: "Music and performance events",
    contactNumber: "9000000003",
  },
];

const DEMO_PARTICIPANTS = [
  {
    type: "IIIT_PARTICIPANT",
    email: "participant.demo@iiit.ac.in",
    password: "password123",
    firstName: "Aarya",
    lastName: "Demo",
    contactNumber: "8000000001",
    collegeOrgName: "IIIT Hyderabad",
    batch: "UG3",
  },
  {
    type: "NON_IIIT_PARTICIPANT",
    email: "external.demo@gmail.com",
    password: "password123",
    firstName: "Riya",
    lastName: "External",
    contactNumber: "8000000002",
    collegeOrgName: "NIT Trichy",
  },
];

const INTERESTS = [
  { name: "Robotics", description: "Bots, control systems, and hardware" },
  { name: "Coding", description: "Programming contests and hackathons" },
  { name: "Literature", description: "Poetry, writing, and speaking" },
  { name: "Music", description: "Instruments, vocals, and bands" },
  { name: "Dance", description: "Solo and group dance forms" },
  { name: "Art", description: "Sketching, painting, and design" },
  { name: "Gaming", description: "Esports and strategy games" },
  { name: "Entrepreneurship", description: "Startup and innovation events" },
];

const CATEGORIES = [
  { name: "Technical", description: "Technical clubs and councils" },
  { name: "Cultural", description: "Cultural clubs and collectives" },
  { name: "Management", description: "Operations and coordination teams" },
];

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const findCategoryId = (categoriesByName, name) => {
  const category = categoriesByName.get(name);
  if (!category) {
    throw new Error(`Category not found while seeding: ${name}`);
  }
  return category._id;
};

const cleanupExistingDemoData = async () => {
  const demoEmails = [
    ...DEMO_ORGANIZERS.map((item) => item.email),
    ...DEMO_PARTICIPANTS.map((item) => item.email),
  ];

  const demoUsers = await User.find({ email: { $in: demoEmails } }).select("_id role");
  const demoUserIds = demoUsers.map((user) => user._id);
  const demoOrganizerIds = demoUsers
    .filter((user) => user.role === "organizer")
    .map((user) => user._id);

  const taggedEvents = await Event.find({ tags: "demo-seed" }).select("_id");
  const organizerEvents =
    demoOrganizerIds.length > 0
      ? await Event.find({ organizerId: { $in: demoOrganizerIds } }).select("_id")
      : [];

  const eventIdSet = new Set();
  for (const event of taggedEvents) eventIdSet.add(String(event._id));
  for (const event of organizerEvents) eventIdSet.add(String(event._id));
  const eventIds = [...eventIdSet];

  if (eventIds.length > 0) {
    await Ticket.deleteMany({ eventId: { $in: eventIds } });
    await Registration.deleteMany({ eventId: { $in: eventIds } });
    await Event.deleteMany({ _id: { $in: eventIds } });
  }

  if (demoUserIds.length > 0) {
    const regIds = await Registration.find({
      $or: [
        { participantId: { $in: demoUserIds } },
        { attendanceMarkedBy: { $in: demoUserIds } },
      ],
    }).select("_id");
    const registrationIds = regIds.map((record) => record._id);

    if (registrationIds.length > 0) {
      await Ticket.deleteMany({ registrationId: { $in: registrationIds } });
    }

    await Registration.deleteMany({
      $or: [
        { participantId: { $in: demoUserIds } },
        { attendanceMarkedBy: { $in: demoUserIds } },
      ],
    });

    await Ticket.deleteMany({ participantId: { $in: demoUserIds } });
    await User.deleteMany({ _id: { $in: demoUserIds } });
  }
};

const seedInterestsAndCategories = async () => {
  const interestsByName = new Map();
  const categoriesByName = new Map();

  for (const interest of INTERESTS) {
    const doc = await Interest.findOneAndUpdate(
      { name: interest.name },
      { $set: { description: interest.description, isActive: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    interestsByName.set(doc.name, doc);
  }

  for (const category of CATEGORIES) {
    const doc = await OrganizationCategory.findOneAndUpdate(
      { name: category.name },
      { $set: { description: category.description } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    categoriesByName.set(doc.name, doc);
  }

  return { interestsByName, categoriesByName };
};

const seedOrganizers = async (categoriesByName) => {
  const organizersByEmail = new Map();

  for (const organizer of DEMO_ORGANIZERS) {
    const hashedPassword = await bcrypt.hash(organizer.password, 10);
    const created = await Organizer.create({
      email: organizer.email,
      password: hashedPassword,
      organizerName: organizer.organizerName,
      category: findCategoryId(categoriesByName, organizer.categoryName),
      description: organizer.description,
      contactNumber: organizer.contactNumber,
      accountStatus: "ACTIVE",
    });

    organizersByEmail.set(created.email, created);
  }

  return organizersByEmail;
};

const seedParticipants = async (interestsByName, organizersByEmail) => {
  const mainInterestIds = [
    interestsByName.get("Coding")._id,
    interestsByName.get("Robotics")._id,
    interestsByName.get("Literature")._id,
  ];
  const externalInterestIds = [
    interestsByName.get("Music")._id,
    interestsByName.get("Entrepreneurship")._id,
  ];

  const followedClubIds = [
    organizersByEmail.get("litclub@clubs.iiit.ac.in")._id,
    organizersByEmail.get("roboclub@clubs.iiit.ac.in")._id,
  ];

  const iiitData = DEMO_PARTICIPANTS[0];
  const nonIiitData = DEMO_PARTICIPANTS[1];

  const iiitPassword = await bcrypt.hash(iiitData.password, 10);
  const nonIiitPassword = await bcrypt.hash(nonIiitData.password, 10);

  const iiitParticipant = await IIITParticipant.create({
    email: iiitData.email,
    password: iiitPassword,
    firstName: iiitData.firstName,
    lastName: iiitData.lastName,
    contactNumber: iiitData.contactNumber,
    collegeOrgName: iiitData.collegeOrgName,
    batch: iiitData.batch,
    interests: mainInterestIds,
    followedClubs: followedClubIds,
  });

  const nonIiitParticipant = await NonIIITParticipant.create({
    email: nonIiitData.email,
    password: nonIiitPassword,
    firstName: nonIiitData.firstName,
    lastName: nonIiitData.lastName,
    contactNumber: nonIiitData.contactNumber,
    collegeOrgName: nonIiitData.collegeOrgName,
    interests: externalInterestIds,
    followedClubs: [organizersByEmail.get("musicclub@clubs.iiit.ac.in")._id],
  });

  return { iiitParticipant, nonIiitParticipant };
};

const seedEvents = async (organizersByEmail) => {
  const litClubId = organizersByEmail.get("litclub@clubs.iiit.ac.in")._id;
  const roboClubId = organizersByEmail.get("roboclub@clubs.iiit.ac.in")._id;
  const musicClubId = organizersByEmail.get("musicclub@clubs.iiit.ac.in")._id;

  const events = {};

  events.upcomingNormal = await Event.create({
    name: "Poetry Slam Night",
    description: "Open mic poetry battle for all participants",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(5),
    startDate: daysFromNow(7),
    endDate: daysFromNow(7),
    registrationLimit: 120,
    registrationFee: 0,
    organizerId: litClubId,
    status: "PUBLISHED",
    tags: ["literature", "open-mic", "demo-seed"],
    customFormSchema: [
      {
        id: "why-join",
        type: "text",
        label: "Why do you want to join?",
        required: true,
        options: [],
        order: 0,
      },
      {
        id: "language",
        type: "dropdown",
        label: "Preferred language",
        required: true,
        options: ["English", "Hindi", "Telugu"],
        order: 1,
      },
    ],
    items: [],
  });

  events.pastNormal = await Event.create({
    name: "Code Relay",
    description: "Timed coding relay challenge",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-20),
    startDate: daysFromNow(-18),
    endDate: daysFromNow(-18),
    registrationLimit: 100,
    registrationFee: 0,
    organizerId: roboClubId,
    status: "PUBLISHED",
    tags: ["coding", "team", "demo-seed"],
    customFormSchema: [
      {
        id: "experience",
        type: "text",
        label: "Coding experience",
        required: true,
        options: [],
        order: 0,
      },
    ],
    items: [],
  });

  events.pastMerchandise = await Event.create({
    name: "Club Merch Drop",
    description: "Limited edition event merchandise",
    type: "MERCHANDISE",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-15),
    startDate: daysFromNow(-14),
    endDate: daysFromNow(-13),
    registrationLimit: 300,
    registrationFee: 0,
    organizerId: musicClubId,
    status: "PUBLISHED",
    tags: ["merch", "limited", "demo-seed"],
    customFormSchema: [],
    items: [
      {
        itemId: "tee-001",
        name: "Fest T-Shirt",
        description: "Official fest cotton t-shirt",
        purchaseLimitPerParticipant: 3,
        variants: [
          {
            variantId: "tee-001-s-black",
            size: "S",
            color: "Black",
            label: "S / Black",
            price: 499,
            stockQty: 20,
          },
          {
            variantId: "tee-001-m-white",
            size: "M",
            color: "White",
            label: "M / White",
            price: 499,
            stockQty: 15,
          },
        ],
      },
    ],
  });

  events.completedNormal = await Event.create({
    name: "Debate Masters",
    description: "Inter-college debate finals",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-40),
    startDate: daysFromNow(-38),
    endDate: daysFromNow(-38),
    registrationLimit: 80,
    registrationFee: 0,
    organizerId: litClubId,
    status: "COMPLETED",
    tags: ["debate", "finals", "demo-seed"],
    customFormSchema: [
      {
        id: "topic-choice",
        type: "dropdown",
        label: "Topic preference",
        required: true,
        options: ["Tech", "Society", "Policy"],
        order: 0,
      },
    ],
    items: [],
  });

  events.cancelledHistory = await Event.create({
    name: "Robo Arena Qualifier",
    description: "Autonomous bot qualifier rounds",
    type: "NORMAL",
    eligibility: "ALL",
    registrationDeadline: daysFromNow(-12),
    startDate: daysFromNow(-10),
    endDate: daysFromNow(-10),
    registrationLimit: 150,
    registrationFee: 0,
    organizerId: roboClubId,
    status: "PUBLISHED",
    tags: ["robotics", "qualifier", "demo-seed"],
    customFormSchema: [
      {
        id: "bot-type",
        type: "checkbox",
        label: "Bot type",
        required: true,
        options: ["Line Follower", "Maze Solver", "Combat"],
        order: 0,
      },
    ],
    items: [],
  });

  return events;
};

const createTicket = async (registration, suffix) => {
  const ticketId = `DEMO-TKT-${suffix}-${Date.now()}`;
  await Ticket.create({
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

const seedRegistrationsAndTickets = async (participants, events, organizersByEmail) => {
  const { iiitParticipant, nonIiitParticipant } = participants;

  const registrations = [];

  registrations.push(
    await Registration.create({
      participantId: iiitParticipant._id,
      eventId: events.upcomingNormal._id,
      status: "REGISTERED",
      teamName: "Verse Vikings",
      responses: {
        "why-join": "To perform and improve stage confidence",
        language: "English",
      },
    })
  );

  registrations.push(
    await Registration.create({
      participantId: iiitParticipant._id,
      eventId: events.pastNormal._id,
      status: "REGISTERED",
      teamName: "CodeSprinters",
      responses: {
        experience: "2 years of competitive programming",
      },
    })
  );

  registrations.push(
    await Registration.create({
      participantId: iiitParticipant._id,
      eventId: events.pastMerchandise._id,
      status: "REGISTERED",
      merchPurchase: {
        itemId: "tee-001",
        variantId: "tee-001-s-black",
        quantity: 2,
        unitPrice: 499,
        totalAmount: 998,
      },
    })
  );

  registrations.push(
    await Registration.create({
      participantId: iiitParticipant._id,
      eventId: events.completedNormal._id,
      status: "COMPLETED",
      responses: {
        "topic-choice": "Tech",
      },
      attended: true,
      attendedAt: daysFromNow(-38),
      attendanceMarkedBy: organizersByEmail.get("litclub@clubs.iiit.ac.in")._id,
    })
  );

  registrations.push(
    await Registration.create({
      participantId: iiitParticipant._id,
      eventId: events.cancelledHistory._id,
      status: "CANCELLED",
      responses: {
        "bot-type": ["Line Follower"],
      },
    })
  );

  registrations.push(
    await Registration.create({
      participantId: nonIiitParticipant._id,
      eventId: events.upcomingNormal._id,
      status: "REGISTERED",
      teamName: "Open Mic Guests",
      responses: {
        "why-join": "Interested in spoken word performances",
        language: "Hindi",
      },
    })
  );

  for (let index = 0; index < registrations.length; index += 1) {
    await createTicket(registrations[index], index + 1);
  }
};

const main = async () => {
  await connectDB();

  await cleanupExistingDemoData();
  const { interestsByName, categoriesByName } = await seedInterestsAndCategories();
  const organizersByEmail = await seedOrganizers(categoriesByName);
  const participants = await seedParticipants(interestsByName, organizersByEmail);
  const events = await seedEvents(organizersByEmail);
  await seedRegistrationsAndTickets(participants, events, organizersByEmail);

  const counts = {
    interests: await Interest.countDocuments(),
    categories: await OrganizationCategory.countDocuments(),
    organizers: await Organizer.countDocuments(),
    participants: await User.countDocuments({
      role: { $in: ["IIIT_PARTICIPANT", "NON_IIIT_PARTICIPANT"] },
    }),
    events: await Event.countDocuments(),
    registrations: await Registration.countDocuments(),
    tickets: await Ticket.countDocuments(),
  };

  console.log("\nDemo data seeded successfully.");
  console.log("\nLogin credentials:");
  console.log("Admin: from backend/.env");
  console.log("Organizer 1:", DEMO_ORGANIZERS[0].email, "/ 123456");
  console.log("Organizer 2:", DEMO_ORGANIZERS[1].email, "/ 123456");
  console.log("Organizer 3:", DEMO_ORGANIZERS[2].email, "/ 123456");
  console.log("Participant (IIIT):", DEMO_PARTICIPANTS[0].email, "/ password123");
  console.log("Participant (External):", DEMO_PARTICIPANTS[1].email, "/ password123");
  console.log("\nCounts:", counts);
};

main()
  .catch((error) => {
    console.error("Failed to seed demo data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
