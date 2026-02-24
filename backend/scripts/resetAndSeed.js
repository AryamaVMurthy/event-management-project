import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  Admin,
  AttendanceAuditLog,
  Event,
  IIITParticipant,
  Interest,
  NonIIITParticipant,
  OrganizationCategory,
  Organizer,
  PasswordResetRequest,
  Registration,
  Ticket,
} from "../models/index.js";

dotenv.config();

const requiredEnv = ["MONGO_URI", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
for (const key of requiredEnv) {
  if (!process.env[key] || !process.env[key].trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const hash = (value) => bcrypt.hash(value, 10);

const categoriesSeed = [
  { name: "Cultural", description: "Dance, music, theatre and arts." },
  { name: "Technical", description: "Coding, robotics and technical showcases." },
  { name: "Literary", description: "Debate, quizzing and writing events." },
  { name: "Sports", description: "Inter-college and campus sports." },
  { name: "Entrepreneurship", description: "Startup and product oriented clubs." },
];

const interestsSeed = [
  { name: "Music", description: "Singing, instruments and production." },
  { name: "Dance", description: "Classical, freestyle and choreography." },
  { name: "Coding", description: "Programming and software development." },
  { name: "Robotics", description: "Hardware builds and automation systems." },
  { name: "Design", description: "Visual design, UI and creative media." },
  { name: "Photography", description: "Photo and video storytelling." },
  { name: "Debating", description: "Public speaking and argumentation." },
  { name: "Quiz", description: "General knowledge and competitive quizzing." },
  { name: "Sports", description: "Athletics and team sports." },
  { name: "Entrepreneurship", description: "Startups, business and innovation." },
];

const organizerSeed = [
  {
    organizerName: "Felicity Organizing Committee",
    email: "felicity.organizer@iiit.ac.in",
    password: "OrgPass@123",
    category: "Cultural",
    description: "Core organizer for Felicity flagship events.",
    contactNumber: "9000000001",
  },
  {
    organizerName: "E-Cell IIITH",
    email: "ecell.organizer@iiit.ac.in",
    password: "OrgPass@123",
    category: "Entrepreneurship",
    description: "Startup and entrepreneurship initiatives at IIITH.",
    contactNumber: "9000000002",
  },
  {
    organizerName: "Robotics Club IIITH",
    email: "robotics.organizer@iiit.ac.in",
    password: "OrgPass@123",
    category: "Technical",
    description: "Hands-on robotics and embedded systems events.",
    contactNumber: "9000000003",
  },
  {
    organizerName: "Lit Club IIITH",
    email: "literary.organizer@iiit.ac.in",
    password: "OrgPass@123",
    category: "Literary",
    description: "Debate, writing and quiz society.",
    contactNumber: "9000000004",
  },
  {
    organizerName: "Sports Council IIITH",
    email: "sports.organizer@iiit.ac.in",
    password: "OrgPass@123",
    category: "Sports",
    description: "Campus sports and tournament organizer.",
    contactNumber: "9000000005",
  },
];

const participantSeed = [
  {
    type: "IIIT_PARTICIPANT",
    email: "ananya.reddy@iiit.ac.in",
    password: "Pass@1234",
    firstName: "Ananya",
    lastName: "Reddy",
    contactNumber: "8000000001",
    batch: "2024",
    interests: ["Music", "Design"],
  },
  {
    type: "IIIT_PARTICIPANT",
    email: "rahul.sharma@iiit.ac.in",
    password: "Pass@1234",
    firstName: "Rahul",
    lastName: "Sharma",
    contactNumber: "8000000002",
    batch: "2023",
    interests: ["Coding", "Robotics"],
  },
  {
    type: "IIIT_PARTICIPANT",
    email: "megha.iyer@iiit.ac.in",
    password: "Pass@1234",
    firstName: "Megha",
    lastName: "Iyer",
    contactNumber: "8000000003",
    batch: "2025",
    interests: ["Debating", "Quiz"],
  },
  {
    type: "NON_IIIT_PARTICIPANT",
    email: "arjun.nair@example.com",
    password: "Pass@1234",
    firstName: "Arjun",
    lastName: "Nair",
    contactNumber: "8000000004",
    collegeOrgName: "BITS Pilani",
    interests: ["Coding", "Entrepreneurship"],
  },
  {
    type: "NON_IIIT_PARTICIPANT",
    email: "riya.kapoor@example.com",
    password: "Pass@1234",
    firstName: "Riya",
    lastName: "Kapoor",
    contactNumber: "8000000005",
    collegeOrgName: "IIT Hyderabad",
    interests: ["Dance", "Photography"],
  },
];

const buildEventDates = () => {
  const now = Date.now();
  return {
    normal1: {
      registrationDeadline: new Date(now + 3 * 24 * 60 * 60 * 1000),
      startDate: new Date(now + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(now + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    },
    normal2: {
      registrationDeadline: new Date(now + 4 * 24 * 60 * 60 * 1000),
      startDate: new Date(now + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
    },
    merch: {
      registrationDeadline: new Date(now + 10 * 24 * 60 * 60 * 1000),
      startDate: new Date(now + 12 * 24 * 60 * 60 * 1000),
      endDate: new Date(now + 16 * 24 * 60 * 60 * 1000),
    },
    draft: {
      registrationDeadline: new Date(now + 8 * 24 * 60 * 60 * 1000),
      startDate: new Date(now + 11 * 24 * 60 * 60 * 1000),
      endDate: new Date(now + 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    },
  };
};

const resetCollections = async () => {
  await AttendanceAuditLog.deleteMany({});
  await Ticket.deleteMany({});
  await Registration.deleteMany({});
  await Event.deleteMany({});
  await PasswordResetRequest.deleteMany({});
  await Admin.deleteMany({});
  await Organizer.deleteMany({});
  await IIITParticipant.deleteMany({});
  await NonIIITParticipant.deleteMany({});
  await Interest.deleteMany({});
  await OrganizationCategory.deleteMany({});
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for reset+seed");

  await resetCollections();
  console.log("Cleared existing app data");

  const adminPasswordHash = await hash(process.env.ADMIN_PASSWORD);
  const admin = await Admin.create({
    email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
    password: adminPasswordHash,
    role: "admin",
  });

  const categories = await OrganizationCategory.insertMany(categoriesSeed);
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const interests = await Interest.insertMany(interestsSeed);
  const interestByName = new Map(interests.map((i) => [i.name, i]));

  const organizers = [];
  for (const seed of organizerSeed) {
    const passwordHash = await hash(seed.password);
    const organizer = await Organizer.create({
      email: seed.email,
      password: passwordHash,
      role: "organizer",
      organizerName: seed.organizerName,
      category: categoryByName.get(seed.category)._id,
      description: seed.description,
      contactNumber: seed.contactNumber,
      accountStatus: "ACTIVE",
    });
    organizers.push(organizer);
  }
  const organizerByName = new Map(organizers.map((o) => [o.organizerName, o]));

  const participants = [];
  for (const seed of participantSeed) {
    const passwordHash = await hash(seed.password);
    const interestIds = seed.interests.map((name) => interestByName.get(name)._id);
    const followedClubs = [
      organizerByName.get("Felicity Organizing Committee")._id,
      organizerByName.get("E-Cell IIITH")._id,
    ];

    const base = {
      email: seed.email,
      password: passwordHash,
      role: seed.type,
      firstName: seed.firstName,
      lastName: seed.lastName,
      contactNumber: seed.contactNumber,
      interests: interestIds,
      followedClubs,
    };

    if (seed.type === "IIIT_PARTICIPANT") {
      participants.push(
        await IIITParticipant.create({
          ...base,
          batch: seed.batch,
          collegeOrgName: "IIIT Hyderabad",
        })
      );
    } else {
      participants.push(
        await NonIIITParticipant.create({
          ...base,
          collegeOrgName: seed.collegeOrgName,
        })
      );
    }
  }

  const dates = buildEventDates();
  const events = await Event.insertMany([
    {
      name: "Battle of Bands 2026",
      description: "Inter-college live band competition at Felicity.",
      type: "NORMAL",
      eligibility: "ALL",
      registrationDeadline: dates.normal1.registrationDeadline,
      startDate: dates.normal1.startDate,
      endDate: dates.normal1.endDate,
      registrationLimit: 120,
      registrationFee: 200,
      organizerId: organizerByName.get("Felicity Organizing Committee")._id,
      tags: ["music", "stage", "felicity"],
      status: "PUBLISHED",
      customFormSchema: [
        {
          id: "experience",
          type: "dropdown",
          label: "Band Experience",
          required: true,
          options: ["Beginner", "Intermediate", "Advanced"],
          order: 0,
        },
        {
          id: "genre",
          type: "text",
          label: "Primary Genre",
          required: true,
          options: [],
          order: 1,
        },
      ],
      items: [],
    },
    {
      name: "HackSprint Prelims",
      description: "Rapid problem solving contest for IIIT students.",
      type: "NORMAL",
      eligibility: "IIIT_ONLY",
      registrationDeadline: dates.normal2.registrationDeadline,
      startDate: dates.normal2.startDate,
      endDate: dates.normal2.endDate,
      registrationLimit: 250,
      registrationFee: 0,
      organizerId: organizerByName.get("Robotics Club IIITH")._id,
      tags: ["coding", "hackathon", "technical"],
      status: "PUBLISHED",
      customFormSchema: [
        {
          id: "github",
          type: "text",
          label: "GitHub Username",
          required: true,
          options: [],
          order: 0,
        },
      ],
      items: [],
    },
    {
      name: "Felicity Official Merchandise",
      description: "Official hoodies and tees for Felicity 2026.",
      type: "MERCHANDISE",
      eligibility: "ALL",
      registrationDeadline: dates.merch.registrationDeadline,
      startDate: dates.merch.startDate,
      endDate: dates.merch.endDate,
      registrationLimit: 1000,
      registrationFee: 0,
      organizerId: organizerByName.get("Felicity Organizing Committee")._id,
      tags: ["merch", "felicity"],
      status: "PUBLISHED",
      customFormSchema: [],
      items: [
        {
          itemId: "hoodie-2026",
          name: "Felicity Hoodie 2026",
          description: "Black cotton hoodie with Felicity crest.",
          purchaseLimitPerParticipant: 2,
          variants: [
            {
              variantId: "hoodie-s-black",
              size: "S",
              color: "Black",
              label: "Hoodie S / Black",
              price: 1499,
              stockQty: 40,
            },
            {
              variantId: "hoodie-m-black",
              size: "M",
              color: "Black",
              label: "Hoodie M / Black",
              price: 1499,
              stockQty: 45,
            },
          ],
        },
      ],
    },
    {
      name: "Startup Pitch Night",
      description: "Pitch your startup idea to mentors and founders.",
      type: "NORMAL",
      eligibility: "ALL",
      registrationDeadline: dates.draft.registrationDeadline,
      startDate: dates.draft.startDate,
      endDate: dates.draft.endDate,
      registrationLimit: 60,
      registrationFee: 100,
      organizerId: organizerByName.get("E-Cell IIITH")._id,
      tags: ["startup", "pitch", "entrepreneurship"],
      status: "DRAFT",
      customFormSchema: [
        {
          id: "idea",
          type: "text",
          label: "Startup Idea in One Line",
          required: true,
          options: [],
          order: 0,
        },
      ],
      items: [],
    },
  ]);

  const eventByName = new Map(events.map((event) => [event.name, event]));
  const participantByEmail = new Map(participants.map((p) => [p.email, p]));

  const registrations = await Registration.insertMany([
    {
      participantId: participantByEmail.get("ananya.reddy@iiit.ac.in")._id,
      eventId: eventByName.get("Battle of Bands 2026")._id,
      status: "REGISTERED",
      responses: { experience: "Intermediate", genre: "Indie Rock" },
      attended: false,
    },
    {
      participantId: participantByEmail.get("rahul.sharma@iiit.ac.in")._id,
      eventId: eventByName.get("HackSprint Prelims")._id,
      status: "REGISTERED",
      responses: { github: "rahul-codes" },
      attended: true,
      attendedAt: new Date(),
      attendanceMarkedBy: organizerByName.get("Robotics Club IIITH")._id,
    },
    {
      participantId: participantByEmail.get("riya.kapoor@example.com")._id,
      eventId: eventByName.get("Felicity Official Merchandise")._id,
      status: "REGISTERED",
      merchPurchase: {
        itemId: "hoodie-2026",
        variantId: "hoodie-m-black",
        quantity: 1,
        unitPrice: 1499,
        totalAmount: 1499,
        paymentStatus: "PENDING_APPROVAL",
      },
    },
    {
      participantId: participantByEmail.get("arjun.nair@example.com")._id,
      eventId: eventByName.get("Felicity Official Merchandise")._id,
      status: "REGISTERED",
      merchPurchase: {
        itemId: "hoodie-2026",
        variantId: "hoodie-s-black",
        quantity: 1,
        unitPrice: 1499,
        totalAmount: 1499,
        paymentStatus: "APPROVED",
        reviewedBy: organizerByName.get("Felicity Organizing Committee")._id,
        reviewedAt: new Date(),
        finalizedAt: new Date(),
        reviewComment: "Payment confirmed",
      },
    },
  ]);

  const registrationByParticipant = new Map(
    registrations.map((registration) => [String(registration.participantId), registration])
  );

  const rahulRegistration =
    registrationByParticipant.get(
      String(participantByEmail.get("rahul.sharma@iiit.ac.in")._id)
    );
  const seededTicketId = `TICKET-SEED-${Date.now()}`;
  if (rahulRegistration) {
    await Ticket.create({
      ticketId: seededTicketId,
      registrationId: rahulRegistration._id,
      participantId: rahulRegistration.participantId,
      eventId: rahulRegistration.eventId,
      qrPayload: {
        ticketId: seededTicketId,
        registrationId: String(rahulRegistration._id),
        eventId: String(rahulRegistration.eventId),
      },
    });
  }

  if (rahulRegistration) {
    await AttendanceAuditLog.create({
      eventId: rahulRegistration.eventId,
      registrationId: rahulRegistration._id,
      ticketId: "seed-ticket-scan",
      scannerId: organizerByName.get("Robotics Club IIITH")._id,
      action: "SCAN_SUCCESS",
      reason: "Seeded initial attended record",
      payload: { source: "resetAndSeed.js" },
    });
  }

  console.log("Seed complete:");
  console.log(`- Admin: ${admin.email}`);
  console.log(`- Categories: ${categories.length}`);
  console.log(`- Interests: ${interests.length}`);
  console.log(`- Organizers: ${organizers.length}`);
  console.log(`- Participants: ${participants.length}`);
  console.log(`- Events: ${events.length}`);
  console.log(`- Registrations: ${registrations.length}`);
  console.log("- Organizer login credentials:");
  for (const organizer of organizerSeed) {
    console.log(`  * ${organizer.email} / ${organizer.password}`);
  }
  console.log("- Participant login credentials:");
  for (const participant of participantSeed) {
    console.log(`  * ${participant.email} / ${participant.password}`);
  }
};

run()
  .catch((err) => {
    console.error("Reset+seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
