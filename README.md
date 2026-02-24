# Event Management System

A full-stack event platform for participant registration, organizer workflows, and admin management.

## Tech Stack
- Backend: Node.js 22+, Express, MongoDB, JWT
- Frontend: React, Vite, Tailwind

## Prerequisites
- Node.js 22+
- npm 10+
- MongoDB database (Atlas)

## Local Setup
1. Backend
   - `cd backend`
   - Copy `.env.example` to `.env` and set values
   - `npm install`
   - `npm start`

2. Frontend
   - `cd frontend`
   - Copy `.env.example` to `.env` if present
   - `npm install`
   - `npm run dev`

## Environment (Backend)
Set the following in `backend/.env`:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `NODE_ENV`
- `FRONTEND_URL`
- SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- `MAX_UPLOAD_MB`
- `EMAIL_FORCE_FAIL_SEND`
- Optional: `EMAIL_MODE=disabled` to run without outbound SMTP

## Project Layout
- `backend/` server, routes, controllers, models
- `frontend/` UI pages and static assets
- `.env.example` and `backend/.env.example` for configuration templates

## Deployment
- Backend deploy target: Render web service
- Frontend deploy target: Vercel
- Ensure `FRONTEND_URL` (backend) and API base URL (frontend) exactly match deployed origins (no trailing slashes)
