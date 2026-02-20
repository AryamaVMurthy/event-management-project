Phase 0: The Setup (Do this first)
Before writing logic, set up the foundation.

Initialize Project: Run npm init -y in your terminal.

Install Dependencies: Install express, mongoose, dotenv, bcryptjs, jsonwebtoken, zod, cors.

Install Dev Tool: Install nodemon as a dev dependency (so you don't have to restart the server manually).

Create Folder Structure: Ensure your folders (config, controllers, middleware, models, routes) exist inside backend.

Step 1: The Secrets & Configuration
Why first? Because your database connection code needs to know where to connect before it can work.

File: Create .env in the root (outside backend folders).

Instruction: Define your PORT, MONGO_URI (Connection string), and JWT_SECRET (Password for your tokens).

File: Create backend/config/db.js.

Instruction: Write an asynchronous function to connect to MongoDB using process.env. Add error handling (console log & exit process) if the connection fails.

Step 2: The Core Data Layer (The Hybrid Model)
Why second? This is the heart of your app. Your Controllers need to import this to save data, and your Routes need to import this to validate data.

File: Create backend/models/User.js.

Instruction A (Database): Define the Mongoose Schema. Include all fields (firstName, lastName, email, roles, participant fields, organizer fields). Enforce uniqueness on email.

Instruction B (Validation): In the same file, define the Zod Schemas (registerSchema and loginSchema). Add the .superRefine logic here to handle the "IIIT vs Non-IIIT" and "Roll Number required" rules.

Instruction C (Export): Export an object containing the Mongoose Model AND the Zod Schemas.

Step 3: The Gatekeeper (Middleware)
Why third? You need a tool to actually run the Zod schemas you just created.

File: Create backend/middleware/validateMiddleware.js.

Instruction: Write a function that accepts a Zod schema as an argument. It should try to .parse() the req.body.

Logic: If successful -> call next(). If it fails -> return 400 status with the error messages.

Step 4: The Logic (Controller)
Why fourth? Now you have a Database Model to save to, and a Validator to trust. You can write the business logic.

File: Create backend/controllers/authController.js.

Instruction (Register): Import the User model. Check if a user exists. Hash the password using bcryptjs. Create the user. Save to DB. Send 201 response.

Instruction (Login): Find the user by email. Compare the password using bcryptjs. If valid, generate a Token using jsonwebtoken. Send 200 response with the token.

Step 5: The Map (Routes)
Why fifth? Now you connect the URLs to the Logic.

File: Create backend/routes/authRoutes.js.

Instruction: Import express, your validateMiddleware, your authController, and the Zod Schemas (from models/User.js).

Logic: Define POST /register. Chain them: validate(registerSchema) -> registerUser. Do the same for Login.

Step 6: The Engine (Entry Point)
Why last? This brings everything together.

File: Create backend/server.js.

Instruction: Initialize Express. Apply JSON middleware (app.use(express.json())). Connect to DB (import from Step 1). Mount the routes (import from Step 5) to /api/auth. Start listening on the PORT.
