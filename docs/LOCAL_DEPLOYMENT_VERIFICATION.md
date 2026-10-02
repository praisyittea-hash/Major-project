# Local and deployment preparation verification

This follow-up preserves the four original module branches and their 36 commits. Changes are made on `chore/local-deployment`, then fast-forwarded into `main` and pushed. No cloud deployment or database migration is performed.

## Changes

- Self-host Lato regular, italic, bold, and black font assets in React; embed licensed Lato regular/bold in generated invoice PDFs.
- Default frontend API calls to `/api`, with a local Vite REST/WebSocket proxy.
- Load backend environment files independently of the working directory; bind to the provider port on all interfaces.
- Share explicit CORS origins between HTTP and Socket.io, with bounded proxy trust.
- Add `npm run setup` to prompt for credentials privately, preserve custom environment settings, generate a JWT secret when needed, and keep secrets out of the frontend.
- Add a combined local startup command, Docker image, Railway/Render configurations, Vercel SPA routes, and a public branded-page metadata function.
- Reuse escaped profile metadata generation between Express and Vercel. Private APIs and data remain on the persistent backend.

## Results actually observed

- `npm test`: **59 passed** (49 backend, 5 frontend, 5 tooling).
- `npm run lint`: passed.
- `npm run build`: passed; self-hosted Lato WOFF/WOFF2 assets emitted.
- `npm run format:check`: passed.
- `npm audit --audit-level=high`: zero vulnerabilities reported.
- `npm run smoke:local`: passed against newly spawned real API/Vite processes and an isolated MongoDB replica set.
- `docker build -t unfazed:local .`: passed.
- `npm run smoke:local -- --docker`: passed against the production image and isolated MongoDB replica set.
- Direct invoice generation inside the production image: passed.
- Smoke checks: readiness, unauthenticated rejection, registration/JWT access, API proxying, explicit CORS, forwarded proxy headers, WebSocket connection/availability subscription, branded Open Graph HTML, production assets, and Lato font delivery.
- Setup tests: private file permissions, no frontend/output secret leakage, environment preservation, generated secret, repeat setup, local and HTTPS split deployment settings.
- Vercel metadata handler tests: public-only upstream endpoint, escaped metadata, frontend asset references, invalid/missing profile rejection, and backend outage handling.
- Railway, Render, and Vercel configuration files validated against their published JSON schemas.
- Invoice fixture rendered with Poppler and visually inspected; `pdffonts` reports embedded/subset Lato-Regular and Lato-Bold.

## Limits

Browser automation access was unavailable, so no full browser visual or checkout interaction is claimed. Frontend component tests, HTTP delivery checks, and PDF visual inspection were performed. No actual provider deployment, user's Atlas connection, real Razorpay test transaction, or live gateway webhook delivery was verified. Existing payment tests use an explicitly stubbed gateway; the real test-mode integration remains credential-dependent.

The smoke scripts do not alter existing databases, use other services' ports, or stop other running processes. Instructions and all provider environment variables are in [DEPLOYMENT.md](DEPLOYMENT.md). The original module inventory and API reference remain in [DAY1_REPORT.md](DAY1_REPORT.md) and [API.md](API.md).
