# Module 7: entitlements and analytics

SubscriptionTierConfig stores key, display name, Boolean feature flags, nullable integer caps, configurable integer-paise price, currency and listing status. Bootstrap defaults are centralized in `config/subscriptionTiers.js`; MongoDB records are the runtime source of truth. Existing configurations, explicit flags, prices and caps are retained. A versioned one-time migration adds newly introduced defaults to the legacy default configuration without changing explicit values. Unknown configurations fail closed.

`EntitlementService.canAccess(therapistId, featureKey)` is the single feature decision function. Existing `hasFeature` callers delegate to it. `assertAccess` emits HTTP 403 with `code: ENTITLEMENT_REQUIRED`, feature key and `/subscription` upgrade path. Therapist entitlement API decisions are consumed by React; no route or component compares subscription tier strings. Architecture tests parse all route/controller/React source files and reject direct tier comparisons or subscription assignment references.

Gated features:

| Feature                                           | Rule                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| clients_add                                       | CRM flag and configured capacity; count current active clients. Null cap means unlimited. |
| note_freeform / note_soap / note_dap              | Configured authoring flags. Existing notes remain readable after a downgrade.             |
| analytics_basic                                   | Basic aggregated analytics endpoint access.                                               |
| analytics_advanced                                | Additional monthly net revenue, fees, payment counts and attendance trend.                |
| Existing profile/scheduling/crm/payments/packages | Continue through the same centralized service.                                            |

Client creation, activation, restoration and booking intake capacity checks run inside existing transactions serialized by the therapist CRM revision. Capacity applies to active clients. Inactive/archived records and their histories are retained.

New therapist APIs:

- GET `/api/therapists/entitlements/:featureKey`: current allow/deny decision.
- GET `/api/subscription`: persisted plans, current plan and own upgrade requests.
- POST `/api/subscription/upgrade-requests`: idempotent pending request; never self-assigns or activates a plan.
- GET `/api/analytics/access?depth=basic|advanced`: gated access check.
- GET `/api/analytics?depth=basic|advanced&from=YYYY-MM-DD&to=YYYY-MM-DD`: aggregated metrics; bounded 366-day range, inclusive UTC date inputs, default past six calendar months.
- POST `/api/scheduling/sessions/:id/no-show`: owning therapist marks an ended confirmed session no-show. Completion uses the Module 6 complete endpoint. Clients cannot mark attendance.

Aggregation pipelines in `analyticsService.js`:

1. Revenue: Payment `$match` tenant, captured/refund_required statuses and capture date; `$group` by practice-timezone month with `$sum` amount, net amount, platform fee and payment count; `$sort` and `$project`. Separate totals pipeline groups all matching payments. Failed, pending and refunded payments are excluded. Pending refund review remains collected until the refund is recorded.
2. Active clients: Client `$match` tenant and current active status, then `$count`. This is current roster size, independent of the date-filtered financial window.
3. No-show rate: Session `$match` tenant, date range, ended sessions and finalized completed/no_show status; `$facet` totals and optional monthly trend; `$group`, `$cond`, `$divide` and `$multiply` compute the rate. Cancelled, pending and unresolved confirmed sessions are excluded. An empty denominator returns zero.

React only displays aggregates and converts paise for currency formatting. Recharts renders revenue and attendance trends; an accessible revenue table accompanies the chart. Analytics depth denial retains prior displayed results and filter state. Upgrade prompts retain client/note drafts and open plan options in a separate tab. Upgrade fulfillment is manual administrator review; subscription purchase automation is outside this scope.

Verification passed with isolated persisted data: live configuration changes; allowed/denied API access; concurrent client caps and restore/activation; note template gates; analytics depth gates; private/shared note API tests; tenant-scoped aggregated revenue and active counts; no-show denominator/empty range; attendance ownership; upgrade requests without privilege escalation; frontend upgrade UI and editor tests; actual backend entrypoint startup/shutdown; full previous-module regressions, lint, build and formatting. The Playwright two-browser flow covers therapist register/login/profile/availability, client branded profile/booking/intake/consent, fixture payment with a signed capture and downloaded invoice, private/shared notes, typing/read receipts and persisted chat after refresh, notification status, three gates with draft preservation, configuration changes, Recharts analytics, billing and upgrade requests. Browser runtime errors are asserted absent and screenshots are retained in `/tmp/unfazed-day2-e2e`.

Live Razorpay checkout verification is deferred until test credentials are supplied, per user instruction. Email is tested against a local SMTP fixture; external SMTP delivery is not configured. WhatsApp always remains a stub. Existing Render, Railway and Vercel deployment configuration is unchanged; no cloud deployment is claimed. The existing development nodemon dependency chain has three high npm audit advisories; no production dependency advisory was reported in this run. No forced downgrade or unrelated dependency replacement was performed.
