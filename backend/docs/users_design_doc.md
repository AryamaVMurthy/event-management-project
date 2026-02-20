# Data Modeling Documentation: User & Domain Entities

## 1. Architecture Overview

This system uses a **Polymorphic Data Model** implemented via Mongoose Discriminators. It enforces strict separation of concerns while maintaining a single `users` collection for authentication.

### Core Principles

* **Single Source of Truth:** Users rely on external "Master Entities" (`Interest`, `OrganizationCategory`) rather than free-text strings. This ensures data consistency for future features like Recommendations.
* **Strict Typing:** `IIITStudent` and `ExternalStudent` are distinct database entities with enforced schema rules (Regex vs. Required Fields).
* **Referential Integrity:** All relationships (Following, Interests, Categories) use strict `ObjectId` foreign keys.

---

## 2. Domain Entities (Master Data)

These collections represent the fixed "vocabulary" of the application. They are managed by the Admin and referenced by Users.

Entity A: Interest 

Represents the "Areas of Interest" a participant can select.

* **Usage:** Referenced by `Participant.interests`.
* **Rationale:** Enables the "Recommendation Engine" by linking Users to Event Tags via a shared ID.

```javascript
import mongoose from "mongoose";

const interestSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  description: { type: String, trim: true }, // Optional metadata
  isActive: { type: Boolean, default: true } // Soft delete support
}, { timestamps: true });

export const Interest = mongoose.model("Interest", interestSchema);

```

Entity B: Organization Category 

Represents the type of an Organizer (e.g., "Club", "Council", "Fest Team").

* **Usage:** Referenced by `Organizer.category`.
* **Rationale:** Ensures consistent filtering on the "Clubs" page.

```javascript
const orgCategorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  // Scalability: Allows adding rules per category later (e.g., "Councils" get higher budget limits)
}, { timestamps: true });

export const OrganizationCategory = mongoose.model("OrganizationCategory", orgCategorySchema);

```

---

## 3. User Hierarchy (Mongoose Schemas)

### 3.1 Abstract Base: User

The root document. All authentication logic happens here.

```javascript
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  [cite_start]}, // [cite: 61]
  password: { 
    type: String, 
    required: true, 
    select: false 
  [cite_start]}, // [cite: 42, 67]
  role: { 
    type: String, 
    enum: ["PARTICIPANT", "ORGANIZER", "ADMIN"], 
    required: true 
  [cite_start]} // [cite: 19]
}, { 
  timestamps: true, 
  discriminatorKey: 'role' // The Polymorphic Switch
});

export const User = mongoose.model("User", userSchema);

```

### 3.2 Abstract Subclass: Participant

Contains fields shared by *all* students, regardless of their origin.

```javascript
const participantSchema = new mongoose.Schema({
  [cite_start]firstName: { type: String, required: true, trim: true }, // [cite: 59]
  [cite_start]lastName: { type: String, required: true, trim: true },  // [cite: 60]
  [cite_start]contactNumber: { type: String, trim: true }, // [cite: 112]
  
  // RELATIONSHIP: Many-to-Many with Interest Entity
  interests: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Interest" 
  }], // [cite: 49]
  
  // RELATIONSHIP: Many-to-Many with Organizer (User)
  followedClubs: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Organizer" 
  }] // [cite: 51]
}, { discriminatorKey: 'participantType' }); // Nested Switch

export const Participant = User.discriminator("PARTICIPANT", participantSchema);

```

### 3.3 Concrete Leaves: The Students

**A. IIIT Student**
Enforces institutional email policy.

```javascript
const iiitStudentSchema = new mongoose.Schema({
  batch: { type: String, trim: true }, // Optional institutional data
});

[cite_start]// [cite: 31] Strict Domain Validation
iiitStudentSchema.path('email').validate((email) => {
   return /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)*iiit\.ac\.in$/.test(email);
}, 'Invalid Domain: IIIT Participants must use an @iiit.ac.in email.');

export const IIITStudent = Participant.discriminator("IIIT_STUDENT", iiitStudentSchema);

```

**B. External Student**
Enforces college name collection.

```javascript
const externalStudentSchema = new mongoose.Schema({
  [cite_start]collegeName: { type: String, required: true, trim: true } // [cite: 112]
});

export const ExternalStudent = Participant.discriminator("EXTERNAL_STUDENT", externalStudentSchema);

```

### 3.4 Concrete Subclass: Organizer

Represents Clubs, Councils, or Teams.

```javascript
const organizerSchema = new mongoose.Schema({
  [cite_start]organizerName: { type: String, required: true, trim: true }, // [cite: 64]
  
  // RELATIONSHIP: Many-to-One with OrganizationCategory Entity
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "OrganizationCategory", 
    required: true 
  [cite_start]}, // [cite: 65]
  
  [cite_start]description: { type: String, trim: true }, // [cite: 68]
  [cite_start]contactEmail: { type: String, trim: true, lowercase: true }, // [cite: 69]
  [cite_start]contactNumber: { type: String, trim: true } // [cite: 66]
});

export const Organizer = User.discriminator("ORGANIZER", organizerSchema);

```

### 3.5 Concrete Subclass: Admin

System administrator.

```javascript
[cite_start]// [cite: 37] Admin is provisioned directly, no extra profile fields needed.
export const Admin = User.discriminator("ADMIN", new mongoose.Schema({}));

```

---

## 4. Data Validation (Zod Schemas)

These schemas enforce the business logic at the API level before database interaction.

```javascript
import { z } from "zod";
import mongoose from "mongoose";

// Helper: Validates MongoDB ObjectId format
const validObjectId = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid ID format",
});

// --- MASTER DATA VALIDATION ---

export const createInterestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const createOrgCategorySchema = z.object({
  name: z.string().min(1, "Category Name is required"),
});

// --- AUTHENTICATION VALIDATION ---

// Base fields for all participants
const baseParticipant = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  contactNumber: z.string().optional(),
  // Validates that specific Interest IDs are sent
  interests: z.array(validObjectId).optional(), 
});

[cite_start]// Discriminated Union for Registration [cite: 30, 31, 32]
export const registerSchema = z.discriminatedUnion("type", [
  // 1. IIIT Student Strategy
  baseParticipant.extend({
    type: z.literal("IIIT_STUDENT"),
    email: z.string().email().regex(/iiit\.ac\.in$/, "Must be an IIIT email"),
    password: z.string().min(6),
  }),
  
  // 2. External Student Strategy
  baseParticipant.extend({
    type: z.literal("EXTERNAL_STUDENT"),
    email: z.string().email(),
    password: z.string().min(6),
    collegeName: z.string().min(1, "College Name is required"),
  })
]);

[cite_start]// Organizer Creation (Admin Action) [cite: 34]
export const createOrganizerSchema = z.object({
  organizerName: z.string().min(1),
  category: validObjectId, // Must match an existing Category ID
  email: z.string().email(), // Login Email
  password: z.string().min(6),
  description: z.string().optional(),
  contactEmail: z.string().email().optional(), // Public Contact Email
  contactNumber: z.string().optional(),
});

```
