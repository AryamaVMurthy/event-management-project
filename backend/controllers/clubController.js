// backend/controllers/clubController.js
// Club Controller: Controller level logic for the feature area.
import bcrypt from "bcryptjs";
import { Event } from "../models/Event.js";
import { Organizer, OrganizationCategory } from "../models/User.js";
import { errors } from "../utils/Errors.js";

// Generate Random Password: Generates random password from existing data. Inputs: none. Returns: a function result.
const generateRandomPassword = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

// Normalize Name For Email: Normalizes names for email subject/body generation. Inputs: name. Returns: a function result.
const normalizeNameForEmail = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

// Generate Organizer Email: Generates organizer email from existing data. Inputs: organizerName. Returns: a function result.
const generateOrganizerEmail = async (organizerName) => {
  const base = normalizeNameForEmail(organizerName) || "club";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    const email = `${base}${suffix}@clubs.iiit.ac.in`;
    const existing = await Organizer.findOne({ email });
    if (!existing) return email;
  }
  throw errors.serverError("Failed to generate unique organizer login email");
};

// Get All Clubs: Returns all clubs/organizations for the platform. Inputs: req, res, next. Returns: a Promise with payload data.
export const getAllClubs = async (req, res, next) => {
  try {
    const clubs = await Organizer.find({ accountStatus: "ACTIVE" })
      .populate("category", "name description");
    return res.status(200).json({ clubs });
  } catch (err) {
    return next(err);
  }
};

// Get All Categories: Gets all categories from persistence or request payload. Inputs: req, res, next. Returns: a Promise with payload data.
export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await OrganizationCategory.find().sort({ name: 1 });
    return res.status(200).json({ categories });
  } catch (err) {
    return next(err);
  }
};

// Create Category: Creates a new event category entry. Inputs: req, res, next. Returns: side effects and response to caller.
export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return next(errors.badRequest("Category name is required"));

    const existing = await OrganizationCategory.findOne({ name: name.trim() });
    if (existing) return next(errors.conflict("Category already exists"));

    const category = await OrganizationCategory.create({
      name: name.trim(),
      description,
    });
    return res.status(201).json({ category });
  } catch (err) {
    return next(err);
  }
};

// Get Club Events Public: Collects published events for one organizer club. Inputs: req, res, next. Returns: a Promise with payload data.
export const getClubEventsPublic = async (req, res, next) => {
  try {
    const club = await Organizer.findById(req.params.id)
      .select("organizerName category description email accountStatus")
      .populate("category", "name description")
      .lean();

    if (!club) {
      return next(errors.notFound("Club not found"));
    }

    if ((club.accountStatus || "ACTIVE") !== "ACTIVE") {
      return next(errors.notFound("Club not available"));
    }

    const events = await Event.find({
      organizerId: club._id,
      status: { $in: ["PUBLISHED", "ONGOING", "CLOSED", "COMPLETED"] },
    })
      .select(
        "name description type status eligibility registrationDeadline startDate endDate registrationLimit registrationFee tags"
      )
      .sort({ startDate: 1 })
      .lean();

    const now = new Date();

    const mapped = events.map((event) => ({
      id: String(event._id),
      name: event.name,
      description: event.description,
      type: event.type,
      status: event.status,
      eligibility: event.eligibility,
      registrationDeadline: event.registrationDeadline,
      startDate: event.startDate,
      endDate: event.endDate,
      registrationLimit: event.registrationLimit,
      registrationFee: event.registrationFee,
      tags: event.tags || [],
    }));

    const upcomingEvents = mapped.filter(
      (event) => event.startDate && new Date(event.startDate) >= now
    );
    const pastEvents = mapped.filter(
      (event) => !event.startDate || new Date(event.startDate) < now
    );

    return res.status(200).json({
      organizer: {
        id: String(club._id),
        organizerName: club.organizerName ?? null,
        category: club.category || null,
        description: club.description ?? null,
        email: club.email ?? null,
      },
      upcomingEvents,
      pastEvents,
    });
  } catch (err) {
    return next(err);
  }
};

// Create Club: Creates a new organizer club row. Inputs: req, res, next. Returns: side effects and response to caller.
export const createClub = async (req, res, next) => {
  try {
    const { organizerName, category, description, contactNumber } = req.body;
    
    if (!organizerName || !category) {
      return next(errors.badRequest("Organizer name and category are required"));
    }
    
    // Verify category exists
    const cat = await OrganizationCategory.findById(category);
    if (!cat) return next(errors.notFound("Category not found"));

    const generatedEmail = await generateOrganizerEmail(organizerName);
    const generatedPassword = generateRandomPassword();
    
    // Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    
    const club = await Organizer.create({
      email: generatedEmail,
      password: hashedPassword,
      organizerName,
      category,
      description,
      contactNumber
    });
    
    // Return without password
    const { password: _, ...clubData } = club._doc;
    return res.status(201).json({
      club: clubData,
      generatedCredentials: {
        email: generatedEmail,
        password: generatedPassword,
      },
    });
  } catch (err) {
    return next(err);
  }
};
