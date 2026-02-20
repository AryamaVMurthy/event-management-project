# Deployment Guide

This guide covers deployment preparation for Assignment 1.

## 1) Required Environment Variables

### Backend (`backend/.env`)

Required keys:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `FRONTEND_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `MAX_UPLOAD_MB`
- `EMAIL_FORCE_FAIL_SEND`

For production:

- Set `FRONTEND_URL` to deployed frontend URL.
- Use production-safe secrets for `JWT_SECRET` and admin credentials.
- Keep `EMAIL_FORCE_FAIL_SEND=false`.

### Frontend (`frontend/.env` or platform env)

Required:

- `VITE_API_URL` set to deployed backend base URL with `/api`.
  - Example: `https://your-backend.onrender.com/api`

## 2) Recommended Hosting Targets

- Frontend: Vercel or Netlify
- Backend: Render or Railway
- Database: MongoDB Atlas

## 3) Deployment Steps

### Backend

1. Push repository to remote.
2. Create backend service on Render/Railway.
3. Set root directory to `backend`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Configure all backend env vars.
7. Verify `GET /api/system/email-health` returns `200`.

### Frontend

1. Create frontend service on Vercel/Netlify.
2. Set root directory to `frontend`.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Set `VITE_API_URL` to backend URL + `/api`.

## 4) Post-Deploy Smoke Checks

Run these after both URLs are live:

1. Open frontend and register/login as participant.
2. Verify browse events loads and event details open.
3. Verify organizer login and event list loads.
4. Verify admin login and organizer management page loads.
5. Verify ticket email health:
   - `GET <backend-url>/api/system/email-health`
6. Verify CORS:
   - Frontend can call backend auth/profile routes successfully.

## 5) `deployment.txt` Submission Contract

`deployment.txt` must include:

- `Frontend URL: <actual frontend url>`

Before final submission:

1. Replace placeholder values in `deployment.txt`.
2. Run:
   - `bash scripts/validate-submission.sh`
3. Ensure validator exits with code `0`.
