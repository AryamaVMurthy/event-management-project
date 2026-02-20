# Email Setup (SMTP Only)

## Required Environment Variables
The backend now requires these values at startup:

1. `SMTP_HOST`
2. `SMTP_PORT`
3. `SMTP_SECURE` (`true` or `false`)
4. `SMTP_USER`
5. `SMTP_PASS`
6. `SMTP_FROM` (valid email)

If any value is missing or invalid, server startup fails immediately.

## Recommended Development Setup (Mailtrap)
Example values:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
SMTP_FROM=no-reply@felicity.iiit.ac.in
```

## Verification at Startup
On boot, backend verifies SMTP connection before listening:

1. Environment is validated.
2. SMTP transporter is created.
3. `transporter.verify()` must pass.

If verification fails, server exits.

## Admin Health Endpoint
Use this endpoint after login as admin:

`GET /api/system/email-health`

Expected response:

```json
{
  "ok": true,
  "mode": "smtp",
  "verifiedAt": "2026-02-17T12:34:56.789Z",
  "host": "sandbox.smtp.mailtrap.io",
  "port": 587
}
```

## Failure Behavior
During registration/purchase:

1. If ticket email cannot be sent, API returns:
   - `HTTP 502`
   - `code: "EMAIL_DELIVERY_FAILED"`
2. Normal event:
   - created registration and ticket are deleted (rollback)
3. Merchandise event:
   - created registration and ticket are deleted
   - decremented stock is restored

## Troubleshooting
1. `SMTP verification failed` at startup:
   - check host/port/secure mismatch
   - check username/password
   - confirm SMTP provider allows connection from your network
2. `EMAIL_DELIVERY_FAILED` at runtime:
   - provider rejected sender/recipient
   - transient provider outage/network issue
3. TLS/auth issues:
   - port `587` usually with `SMTP_SECURE=false`
   - port `465` usually with `SMTP_SECURE=true`

