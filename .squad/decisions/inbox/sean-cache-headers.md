### 2026-07-02: Added Cache-Control headers
**By:** Sean
**What:** Added Cache-Control headers to GET /api/reservations/blocked-dates (public, max-age=300), GET /api/reservations/blocked-times (private, max-age=60), and GET /api/tenants/:id (public, max-age=3600).
**Why:** Approved in documentation/api-request-optimisation.md — reduces redundant D1 queries and Worker invocations.
