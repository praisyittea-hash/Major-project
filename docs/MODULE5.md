# Module 5: clinical documentation

New SessionNote records have `type: private | shared`, `format: freeform | soap | dap`, title and bounded JSON content. Private is the default. Existing privateContent/sharedContent records are retained without a destructive migration. Legacy shared text remains readable; legacy private text remains therapist-only.

Therapist APIs (JWT and CRM entitlement required):

- GET/POST `/api/notes/client/:clientId`
- GET/PATCH/DELETE `/api/notes/:id`

Client APIs (scoped client JWT): GET `/api/portal/notes` and GET `/api/portal/history`. Queries constrain both tenant and client. An allowlist serializer rejects private notes even if handed a fully loaded document. Clients cannot supply another client ID to access their notes. Updates cannot change note ownership; session references must belong to the same therapist and client. Structured content is validated against the selected template; freeform content accepts a bounded TipTap JSON tree. Rendering uses React text nodes, never injected HTML.

Clinical documentation is available in each therapist client profile. The client portal renders only server-shared notes. Editors preserve each format's unsaved draft while switching and retain the draft on API failures. Sharing a note shares its entire content; changing it to private withdraws it from subsequent API responses. Previously downloaded client copies cannot be recalled.

Verification: isolated MongoDB replica set plus actual Express API requests in `notes-api.test.js`, schema checks in `notes.test.js`, and frontend renderer/editor tests. The API test uses exactly “This is private therapist information.” and “This information is safe for the client.” and asserts both client response bodies. Additional tests exercise JWT rejection, therapist/client ownership, forbidden editing, malformed documents, foreign session references, SOAP/DAP and withdrawn sharing. Full Day 1 regression tests, lint, build and formatting run before each commit.
