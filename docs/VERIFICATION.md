# Verification and local operation

Use Node.js 24+ and install from the workspace root with `npm ci`.

1. Copy `unfazed-backend/.env.example` to `unfazed-backend/.env` and `unfazed-frontend/.env.example` to `unfazed-frontend/.env`.
2. Configure MongoDB (Atlas or a local **replica set**) and a random JWT secret of at least 32 characters. Backend startup validates its configuration and connects before listening.
3. Run `npm run dev:api` and `npm run dev:web` in separate terminals.
4. To add fictional development data, explicitly set `SEED_DATABASE_ALLOW=true` and a development-only `SEED_PASSWORD`, then run `npm run seed -w unfazed-backend`. The seed inserts two therapists, three clients, sessions and package offers. It preserves existing profiles/contacts/financial records and backfills missing client references on its own seed sessions. It handles slug collisions without overwriting another profile. Never point this command at a production database.
5. Run `bash scripts/check.sh`: backend integration/unit tests, frontend DOM component tests, ESLint, production frontend build, formatting, diff whitespace checks and tracked environment checks. Tests use isolated MongoDB; they never connect to the application database. The first test run downloads a MongoDB binary.

## Observed checks

- Backend tests: **49 passed**, zero failures/skips, using a real isolated MongoDB replica set.
- Frontend component tests: **5 passed**, using jsdom and Testing Library. These test explicit consent, UTC-to-local slot labels/selection, slot empty state, CRM sorting/profile links, and checkout failure without fabricated success.
- Full integration suite also checks concurrent booking conflicts, tenant separation, private/shared note separation, configured client capacity, package exhaustion/expiry/ownership, repeated seed preservation, Razorpay adapter failures, signed webhook capture/replay, wrong signatures/amounts, failure ordering, stored PDFs and late-payment refund flags.
- Backend and Vite frontend started locally; MongoDB connected in an isolated development harness. Production frontend build and lint pass. No deployment has been performed.
- PDF sample generated with PDFKit, rendered with Poppler, and visually inspected: one A4 page with no clipping/overlap in the tested fixture.
- Browser interaction was attempted, but browser approval denied access to localhost. Actual interactive Chrome checkout, responsive layout and full browser navigation have **not** been verified.
- Razorpay integration tests inject a labeled fixture gateway and sign fixture payloads. They prove application logic and persistence, **not** successful real Razorpay transactions.
- No Razorpay test credentials or application MongoDB URI were supplied. A real Razorpay test checkout, provider-originated webhook delivery and the user's Atlas connection remain **unverified**.

## Required real Razorpay test acceptance

Configure backend-only `RAZORPAY_KEY_ID` (`rzp_test_...`), `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` (20+ characters). Configure the test-mode webhook in Razorpay to your publicly reachable HTTPS `/api/payments/webhook` endpoint, subscribing to `payment.captured` and `payment.failed`. Enable automatic capture in the test dashboard. Configure the frontend public test key if desired; checkout uses the server-provided public key associated with its order.

Then register/login, publish a priced service, configure availability, reserve a slot, complete intake/consent, and pay with Razorpay's official test methods. Verify the order/payment in the Razorpay dashboard, signed webhook receipt in the app, a confirmed session, a captured payment and downloadable PDF. Repeat for 3/6/12-session packages, failed payment, repeated webhook delivery and expiry/cancellation. Do not treat a client callback as payment confirmation.

Official integration references: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [Webhook validation/testing](https://razorpay.com/docs/webhooks/validate-test/).

## Remaining operational limitations

- Notification jobs are intentionally stubbed; external delivery is not configured.
- Refunds and ambiguous external order failures require operator reconciliation; the app records the state and does not perform automatic refunds.
- GST-style invoice fields/tax reflect configuration; no GSTIN is invented. Review actual supplier/tax settings before using invoices outside test mode. The current PDF standard font has limited support for non-Latin names.
- Private PDFs are stored in MongoDB; a private S3 provider is an available architectural extension, not a configured integration.
- Portal links are expiring bearer capabilities, not password/OTP client accounts. Share them securely.
- Histories/appointment responses are bounded; large practices will need extended history pagination.
- Later modules have not been implemented. Notes storage/history boundaries exist solely for Module 3 aggregation; there is no note authoring, chat or analytics implementation.
