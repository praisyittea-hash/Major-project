# Unfazed

Modules 1–7: foundations, scheduling, CRM/intake, payments/packages, clinical documentation, communication, and subscriptions/analytics.

React + Vite frontend, Express API and MongoDB/Mongoose persistence. Install from the root with `npm install`. Run `npm run dev:api` and `npm run dev:web` in separate terminals.

Copy each `.env.example` into its sibling `.env`; configure MongoDB and a random JWT secret. Backend commands load `unfazed-backend/.env`. No real credentials belong in Git. Backend refuses to start without its database and secure JWT configuration.

`npm test` starts an isolated MongoDB replica set (first run downloads MongoDB); it never connects to your application database. `bash scripts/check.sh` runs tests, lint, build, diff and tracked environment checks.

After Module 1: set `SEED_DATABASE_ALLOW=true` and a development-only `SEED_PASSWORD`, then run `npm run seed -w unfazed-backend`. Seeding is idempotent and only inserts missing fixtures; it never deletes records or overwrites existing profile, contact, or financial data. It backfills a missing client reference only on known seed sessions.

For social previews, build and serve the frontend through Express on port 5000: branded routes return crawler-visible Open Graph metadata. Vite development uses client-side metadata. Production must set `PUBLIC_BASE_URL` and `FRONTEND_URL` to its origin and build with `VITE_API_BASE_URL=/api`.

Scheduling uses UTC session instants and IANA availability timezones. MongoDB **must run as a replica set** (Atlas already does): booking conflicts are serialized with transactional writes to each therapist's availability document. A standalone MongoDB server is not supported for booking. A buffer must fit inside each availability window.

## Local setup and cloud deployment

Run `npm ci`, then `npm run setup` for interactive credentials and `npm run dev` to start both services. Lato is self-hosted throughout the app and embedded in invoice PDFs. See [the deployment guide](docs/DEPLOYMENT.md) for Railway, Render, Vercel, environment settings, and verification limits.

## Day 2 modules

Clinical documentation lives in each therapist client profile; shared notes appear in the client portal. Freeform notes use TipTap, with selectable SOAP and DAP formats. Chat persists messages and supports typing and read receipts. Notifications use a transactional outbox, a permanent WhatsApp stub and optional Nodemailer SMTP support.

Subscription configuration lives in MongoDB. `EntitlementService.canAccess(therapistId, featureKey)` controls active client limits, note formats and analytics depth. `/subscription` displays configured plans and saves upgrade requests for administrator review; requests never activate privileges themselves. `/analytics` visualizes backend MongoDB aggregations with Recharts.

See [Module 5](docs/MODULE5.md), [Module 6](docs/MODULE6.md) and [Module 7](docs/MODULE7.md) for APIs, privacy rules, configuration and verification. Existing deployment configuration is preserved.

For the browser integration test, run `npx playwright install chromium`, `npm run build`, then `npm run test:e2e`. It starts an isolated MongoDB replica set and local API with two browser contexts. Payment uses an explicitly isolated gateway/checkout fixture plus signed webhook verification; no live Razorpay checkout or external notification delivery is claimed. Local artifacts are saved under `/tmp/unfazed-day2-e2e`. Real test credentials belong only in the ignored backend `.env`.
