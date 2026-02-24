# Felicity Event Management Project

Full-stack event platform for participants, organizers, and admin.

## Stack
1. Frontend: React + Vite + shadcn/ui
2. Backend: Node.js (22.x), Express, MongoDB, GridFS, JWT auth

## Implemented Advanced Feature Set
This repository implements the selected advanced issues end-to-end:
1. Organizer password reset request + review workflow (ADV-01, ADV-02)
2. Calendar export and provider links (single + batch ICS) (ADV-03, ADV-04)
3. Merchandise payment approval lifecycle
- Purchase creates pending order
- Participant uploads payment proof
- Organizer reviews approve/reject
- Approval finalizes stock + ticket + email transactionally (ADV-05, ADV-06, ADV-07)
4. QR attendance scanner flow
- QR scan endpoint with duplicate/invalid protection
- Manual override endpoint with reason
- Live attendance summary + audit logs
- Organizer scanner UI panel with decoded input/image/camera paths (ADV-08, ADV-09)

## Important Endpoints Added
1. `/api/calendar/registrations/:registrationId.ics`
2. `/api/calendar/registrations/:registrationId/links`
3. `/api/calendar/my-events.ics`
4. `/api/events/registrations/:registrationId/payment-proof`
5. `/api/events/organizer/events/:id/merch-orders`
6. `/api/events/organizer/events/:id/merch-orders/:registrationId/review`
7. `/api/events/organizer/events/:id/attendance/scan`
8. `/api/events/organizer/events/:id/attendance/override`
9. `/api/events/organizer/events/:id/attendance/live`

## Run Locally
1. Backend
```bash
cd backend
npm install
npm start
```
2. Frontend
```bash
cd frontend
npm install
npm run dev
```
