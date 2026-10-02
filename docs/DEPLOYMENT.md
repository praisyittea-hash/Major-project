# Local setup and deployment

Requires Node.js 24 and a MongoDB replica set (MongoDB Atlas is suitable). The database uses transactions: a standalone MongoDB instance is insufficient. No real credentials are checked into Git.

## Run locally

```sh
npm ci
npm run setup
npm run dev
```

The interactive setup asks for the database URI, a JWT secret (blank generates one), API port, frontend origin, and optional Razorpay **test** credentials plus webhook secret. Sensitive input is hidden on a terminal. It writes ignored backend/frontend `.env` files with owner-only permissions and preserves custom variables and comments. Choose `local` to use the Vite API and WebSocket proxy. The frontend opens at `http://localhost:5173`; the default API port is 5000.

`npm run dev` starts both services and shuts down both when either exits. API changes require restarting this combined command; `npm run dev:api` separately provides nodemon reloads. Existing occupied ports are reported, never forcibly cleared. For a full-stack production preview, run `npm run build` then `npm start`; open the API port. For a fresh isolated database check without using your data, run `npm run build && npm run smoke:local`.

To seed your development database deliberately, follow the opt-in seed instructions in README.md. Setup and startup do not seed, drop, or reset databases.

## Railway / Render: one full-stack service

Both configurations use the root Dockerfile to build React and run Express, Socket.io, and the reservation cleanup worker. Express serves the built frontend, API, and branded Open Graph HTML. Keep the project root at the repository root. Use one service instance for the current Socket.io room architecture; multiple instances require a shared socket adapter before scaling.

- Railway: connect this GitHub repository and use `railway.json` with the Dockerfile builder. Generate the service domain.
- Render: import `render.yaml` as a Blueprint. Select the compute plan intentionally; automatic deployments are disabled in the supplied Blueprint. The provider must keep the service available for timely webhook delivery and reservation cleanup.

Run `npm run setup` and choose the matching target, entering the final HTTPS frontend/service origin. Transfer **backend** environment values to the provider's environment settings. Set `MONGO_URI`, `JWT_SECRET` (or Render's generated value), `FRONTEND_URL`, `PUBLIC_BASE_URL`, `NODE_ENV=production`, and `TRUST_PROXY_HOPS=1`. Use the provider's injected `PORT`, rather than copying the local port. Set monetary/invoice configuration from `unfazed-backend/.env.example` as needed. Do not store `.env` files in Git or upload them as public assets.

For payments, also configure `RAZORPAY_KEY_ID` (`rzp_test_`), `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the test gateway webhook at `https://YOUR_BACKEND/api/payments/webhook` with the same webhook secret and the captured/failed payment events. Only a verified webhook confirms payment. Callback tests and mock gateway tests do not demonstrate a successful real Razorpay transaction.

Readiness is `GET /api/ready` (200 only with MongoDB connected); `/api/health` reports API process health. Atlas network access must permit the chosen backend host. The image runs as an unprivileged user and excludes environment files.

## Vercel frontend + Railway / Render backend

Deploy the backend above first. Vercel hosts React and the small **public profile metadata** function; persistent API, sockets, MongoDB transactions, and cleanup remain on Railway/Render.

1. Run `npm run setup`, choose `vercel`, and enter both HTTPS origins.
2. Import this repository into Vercel at its root. `vercel.json` sets the workspace build and frontend output directory.
3. Set `VITE_API_BASE_URL=https://YOUR_BACKEND/api`, optional public `VITE_RAZORPAY_KEY_ID`, and `PUBLIC_BASE_URL=https://YOUR_FRONTEND` in Vercel. These are public values. Rebuild after changing `VITE_*` variables.
4. Set `FRONTEND_URL` and `PUBLIC_BASE_URL` on the backend to the Vercel frontend origin. Additional approved origins can be comma-separated in `FRONTEND_URLS`, which overrides `FRONTEND_URL`. Explicitly allow an intended preview origin; wildcard preview access is not enabled.

SPA rewrites preserve dashboard, portal, booking, and payment deep links. A single branded slug is handled by `api/branded-profile.js`, which retrieves only the public profile and injects escaped metadata into **Vercel's own** built HTML. This avoids mixing asset hashes from different builds. A missing profile returns 404; unavailable backend returns 503. The browser connects directly to the backend for API calls and sockets.

Never put MongoDB credentials, JWT secrets, Razorpay key secrets, or webhook secrets in Vercel's public `VITE_*` variables.

## Verification and limits

Run `npm test`, `npm run lint`, `npm run build`, `npm run format:check`, and `npm run smoke:local`. The smoke script creates an isolated temporary MongoDB replica set and starts actual API/Vite processes; it verifies auth, proxying, CORS, metadata, built assets, Lato font delivery, and WebSocket connections, then cleans up only its own resources.

Local tests do not prove provider account access, Atlas access from a deployed host, real gateway checkout, or live webhook delivery. After deployment, verify readiness, registration/login, a branded link including page source metadata, socket slot updates, and a real Razorpay test checkout plus captured webhook. No live deployment is performed by these scripts.

Configuration references: [Railway config as code](https://docs.railway.com/config-as-code/reference), [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Vercel Vite deployments and SPA rewrites](https://vercel.com/docs/frameworks/frontend/vite).

For a Linux Docker runtime check, run `docker build -t unfazed:local .` followed by `npm run smoke:local -- --docker`. This uses host networking to reach the smoke script's isolated replica set. It requires a local Docker daemon and removes its container after checking it.
