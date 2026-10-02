# Unfazed

Day 1 scope: foundations, scheduling, CRM/intake, and payments/packages.

React + Vite frontend, Express API and MongoDB/Mongoose persistence. Install from the root with `npm install`. Run `npm run dev:api` and `npm run dev:web` in separate terminals.

Copy each `.env.example` into its sibling `.env`; configure MongoDB and a random JWT secret. Backend commands load `unfazed-backend/.env`. No real credentials belong in Git. Backend refuses to start without its database and secure JWT configuration.

`npm test` starts an isolated MongoDB replica set (first run downloads MongoDB); it never connects to your application database. `bash scripts/check.sh` runs tests, lint, build, diff and tracked environment checks.

After Module 1: set `SEED_DATABASE_ALLOW=true` and a development-only `SEED_PASSWORD`, then run `npm run seed -w unfazed-backend`. Seeding is idempotent and only inserts missing fixtures; it never deletes or updates existing data.

For social previews, build and serve the frontend through Express on port 5000: branded routes return crawler-visible Open Graph metadata. Vite development uses client-side metadata. Production must set `PUBLIC_BASE_URL` and `FRONTEND_URL` to its origin and build with `VITE_API_BASE_URL=/api`.

Scheduling uses UTC session instants and IANA availability timezones. MongoDB **must run as a replica set** (Atlas already does): booking conflicts are serialized with transactional writes to each therapist's availability document. A standalone MongoDB server is not supported for booking. A buffer must fit inside each availability window.
