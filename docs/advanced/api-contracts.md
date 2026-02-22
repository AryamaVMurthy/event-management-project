# Advanced API Contracts

## Organizer Password Reset
1. `POST /api/user/password-reset-requests`
2. `GET /api/user/password-reset-requests`

## Calendar
1. `GET /api/calendar/registrations/:registrationId.ics`
2. `GET /api/calendar/registrations/:registrationId/links`
3. `GET /api/calendar/my-events.ics?registrationIds=<id1,id2>&reminderMinutes=<int>`

## Merchandise Payment Lifecycle
1. `POST /api/events/:id/purchase`
Returns registration with `registration.merchPurchase.paymentStatus`.

2. `POST /api/events/registrations/:registrationId/payment-proof` (multipart: `paymentProof`)
Transitions status to `PENDING_APPROVAL`.

3. `GET /api/events/registrations/:registrationId/payment-proof`
Returns payment-proof metadata (owner participant, organizer for event, admin).

4. `GET /api/events/registrations/:registrationId/payment-proof?download=true`
Downloads payment-proof file.

5. `GET /api/events/organizer/events/:id/merch-orders?paymentStatus=<ALL|PAYMENT_PENDING|PENDING_APPROVAL|APPROVED|REJECTED>`
Lists merchandise orders for organizer/admin view.

6. `PATCH /api/events/organizer/events/:id/merch-orders/:registrationId/review`
Body:
```json
{
  "status": "APPROVED" | "REJECTED",
  "reviewComment": "optional"
}
```

## QR Attendance
1. `POST /api/events/organizer/events/:id/attendance/scan`
Body:
```json
{
  "qrPayload": {
    "ticketId": "...",
    "registrationId": "...",
    "participantId": "...",
    "eventId": "..."
  }
}
```
Also accepts `qrPayload` as JSON string.

2. `POST /api/events/organizer/events/:id/attendance/override`
Body:
```json
{
  "registrationId": "...",
  "attended": true,
  "reason": "required"
}
```

3. `GET /api/events/organizer/events/:id/attendance/live`
Returns live counts and recent audit logs.
