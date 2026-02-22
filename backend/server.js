// javascript
import express from "express";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import { seedAdmin } from "./config/seedAdmin.js";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import interestRoutes from "./routes/interestRoutes.js";
import clubRoutes from "./routes/clubRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { initMailer } from "./utils/mailer.js";

const app = express();
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
// Connect to MongoDB
await connectDB();
await initMailer();
console.log(`SMTP verified on ${env.SMTP_HOST}:${env.SMTP_PORT}`);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes)
app.use("/api/interests", interestRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/admin", adminRoutes);

// Basic error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const body = { message: err.message || "Internal Server Error" };
  if (err.code) {
    body.code = err.code;
  }
  res.status(status).json(body);
});

// Create admin if missing (reads ADMIN_EMAIL & ADMIN_PASSWORD from env)
await seedAdmin();

app.listen(env.PORT, () => console.log(`Server listening on ${env.PORT}`));
