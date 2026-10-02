# Day 1 API

All paths below have `/api` as their prefix. Authentication uses `Authorization: Bearer <JWT>`. Therapist JWTs expire after 8 hours; scoped client/booking JWTs after 24 hours. IDs are validated MongoDB ObjectIds. No client endpoint returns private notes. Protected data responses use `Cache-Control: private, no-store`.

| Method | Path                                  | Access                                | Purpose                                                                |
| ------ | ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/health`                             | Public                                | API process liveness                                                   |
| GET    | `/ready`                              | Public                                | MongoDB readiness (503 when disconnected)                              |
| POST   | `/auth/register`                      | Public, rate limited                  | Register therapist; bcrypt password hash and unique slug               |
| POST   | `/auth/login`                         | Public, rate limited                  | Login and issue JWT                                                    |
| GET    | `/auth/me`                            | Therapist                             | Current account                                                        |
| GET    | `/therapists/me`                      | Therapist                             | Profile                                                                |
| PATCH  | `/therapists/me`                      | Therapist                             | Edit allowed public profile fields, services and slug                  |
| GET    | `/therapists/entitlements`            | Therapist                             | Centralized configured feature access and caps                         |
| GET    | `/public/:slug`                       | Public, rate limited                  | Explicitly allowlisted public profile and static intake template       |
| GET    | `/public/:slug/slots`                 | Public, rate limited                  | UTC slots; `from`, `to` (YYYY-MM-DD), `duration` required              |
| POST   | `/public/:slug/book`                  | Public, rate limited                  | Reserve service/time; contact name/email; return booking capability    |
| POST   | `/public/:slug/waitlist`              | Public, rate limited                  | Join a date/duration waitlist; delivery is stubbed                     |
| GET    | `/scheduling/availability`            | Therapist + scheduling access         | Current weekly hours, exceptions and settings                          |
| PUT    | `/scheduling/availability/weekly`     | Therapist + scheduling access         | Weekly day/window templates and IANA timezone                          |
| PUT    | `/scheduling/availability/exceptions` | Therapist + scheduling access         | Date overrides and UTC blocked intervals                               |
| PUT    | `/scheduling/availability/settings`   | Therapist + scheduling access         | Enabled 30/45/60/90-minute durations and buffer                        |
| GET    | `/scheduling/sessions`                | Therapist + scheduling access         | Owned appointments                                                     |
| POST   | `/scheduling/sessions/:id/cancel`     | Therapist + scheduling access         | Cancel; restore package credit; queue waitlist stub; flag paid refunds |
| GET    | `/bookings/:id`                       | Owning booking/client/therapist JWT   | Booking details                                                        |
| POST   | `/bookings/:id/intake`                | Owning booking JWT                    | Intake + consent; create a new client and scoped client JWT            |
| GET    | `/clients`                            | Therapist + CRM access                | Sort, filter and paginate owned clients                                |
| POST   | `/clients`                            | Therapist + CRM access                | Create a client within configured capacity                             |
| GET    | `/clients/:id`                        | Therapist + CRM access                | Client profile, private intake and consent audit                       |
| PATCH  | `/clients/:id`                        | Therapist + CRM access                | Edit allowed contact/status/tag fields                                 |
| DELETE | `/clients/:id`                        | Therapist + CRM access                | Archive; preserve records/history                                      |
| GET    | `/clients/:id/history`                | Therapist + CRM access                | Owned sessions, payments and private/shared notes                      |
| POST   | `/clients/:id/portal-link`            | Therapist + CRM access                | Create a 24-hour client capability URL (fragment token)                |
| GET    | `/portal/me`                          | Client + CRM access                   | Own intake/profile and current consent template                        |
| POST   | `/portal/intake`                      | Client + CRM access                   | Persist own intake and consent audit transactionally                   |
| GET    | `/portal/history`                     | Client + CRM access                   | Own sessions/payments; shared notes only                               |
| POST   | `/portal/book`                        | Client + CRM/scheduling access        | Book after consent; optionally redeem an owned package                 |
| POST   | `/payments/session/:id/orders`        | Owning booking/client JWT             | Create/reuse server-priced Razorpay test order after consent           |
| GET    | `/payments`                           | Therapist + payments access           | Billing dashboard payment statuses                                     |
| GET    | `/payments/:id`                       | Owning therapist/client/booking JWT   | Payment status and invoice metadata                                    |
| POST   | `/payments/:id/verify`                | Owning therapist/client/booking JWT   | Verify checkout signature and gateway data; await webhook              |
| GET    | `/payments/:id/invoice`               | Owning therapist/client/booking JWT   | Download generated PDF after capture                                   |
| POST   | `/payments/webhook`                   | Raw-body Razorpay HMAC signature      | Authoritative `payment.captured` / `payment.failed` handling           |
| GET    | `/packages`                           | Therapist + packages access           | Owned templates and configured package options                         |
| POST   | `/packages`                           | Therapist + packages access           | Create service-specific 3/6/12-session package                         |
| DELETE | `/packages/:id`                       | Therapist + packages access           | Archive offer; preserve purchased package snapshots                    |
| GET    | `/packages/portal`                    | Client + CRM/packages access          | Own package balances and practice offerings/services                   |
| POST   | `/packages/:id/orders`                | Client + CRM/packages/payments access | Buy package with UUID idempotency key                                  |

## Request details

Profile service fees and payment amounts are integer **paise**. UI forms display INR. Clients cannot set payment amounts, therapist ownership, consent timestamps or payment status. Profile service entries referenced by appointments/packages cannot be removed; they can be edited, preserving booking and package references.

Availability weekly days use `0=Sunday ... 6=Saturday`. Windows use `HH:mm`, with increasing times and no overlap. Overrides replace the weekly hours on their date, with `blocked: true` for a full-day block. Partial blocked intervals use ISO timestamps. Query date ranges are limited to 31 days. Session instants are UTC; calendars and slot labels show the client's device timezone. DST-invalid boundary times produce no slots.

Client list query parameters: `search`, `status` (`active`, `inactive`, `archived`), `tag`, `sort` (`name`, `lastSession`, `status`, `createdAt`), `direction` (`asc`, `desc`), `page`, `limit` (maximum 100). Last-session values are computed from owned past confirmed/completed sessions. Histories are bounded to 200 records and the appointment list to 500.

Intake request shape:

```json
{
  "demographics": {
    "age": 29,
    "pronouns": "she/her",
    "location": "Bengaluru",
    "occupation": "Designer"
  },
  "presentingConcern": "Looking for support with work stress.",
  "history": { "priorTherapy": "", "medicalHistory": "", "medications": "" },
  "consent": { "accepted": true, "version": "consent-v1" }
}
```

Consent text/version comes from the static template. The checkbox must be literal boolean `true`. Accepted time and audit identity are server-generated. An existing email address submitted to public booking does **not** grant existing client history: existing clients use therapist-issued portal links. Portal URLs use fragments so credentials are not sent in URLs to the API/server or normal referrer headers. Treat links as confidential bearer credentials; they expire after 24 hours. Archiving denies portal access.

Checkout verification expects `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The callback only records `verified`; a captured webhook confirms the booking and creates the stored PDF/package. Webhook signatures use exact raw bytes, not reserialized JSON. Webhook event IDs are recorded transactionally; duplicate events are safe. Unknown signed order events return a retryable non-success response until the order is persisted.

Reservations expire according to `BOOKING_HOLD_MINUTES`. The expiry worker runs every minute, and slot generation immediately excludes expired holds. Captures received after expiry/cancellation are recorded as `refund_required`; they never silently rebook an unavailable time. Paid cancellations also require manual refund review. Automatic refund initiation and refund-event reconciliation are not implemented.

Order creation is claimed once per persisted purchase. An ambiguous gateway failure records `order_error`, requiring operator reconciliation rather than creating duplicate external orders on retry. Package purchase idempotency keys must be UUIDs. Package snapshot prices/expiry are frozen at order creation and activated after webhook capture. Credits are debited atomically with booking and restored once on cancellation. Expiry is checked against both the current time and the proposed appointment time.

## Deployment and integration boundaries

Express serves the built frontend and injects crawler-visible Open Graph tags for branded routes. Use `VITE_API_BASE_URL=/api` for this setup. Configure `PUBLIC_BASE_URL` and `FRONTEND_URL` for the deployment origin. Helmet's CSP permits the Razorpay checkout script/frame; secret keys remain backend-only.

Razorpay is isolated in `paymentGateway.js`. Notification delivery uses a persisted stub; no emails/SMS are sent. Private invoice storage uses `storageService.js`, currently backed by MongoDB, replaceable by a private S3 adapter. Socket.io broadcasts only availability invalidations, without client/clinical payloads. Chat, notes authoring, analytics, lead distribution and later modules are outside Day 1 scope.
