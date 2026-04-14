# Squad Decisions

## Active Decisions

### 2026-04-01: Tech stack confirmed
**By:** James Healy
**What:** Stack is Cloudflare Workers + Pages, D1 (SQLite), Hono (API framework), vanilla HTML/CSS/JS widget (no frontend framework).
**Why:** Lightweight embeddable widget must work on any site with minimal footprint. Cloudflare-native stack keeps latency low and ops simple.

### 2026-04-01: Team cast
**By:** James Healy
**What:** Team roster confirmed - Han (Lead), Sean (Backend), Twinkie (Frontend), Neela (Tester), Scribe, Ralph.
**Universe:** Fast and Furious: Tokyo Drift.

### 2026-04-01: No git operations by Copilot/squad
**By:** James Healy (via Copilot)
**What:** Squad must never run `git add`, `git commit`, or `git push`. Version control is managed exclusively by James.
**Why:** User request - captured for team memory.

### 2026-04-01: Calendar widget - design decisions
**By:** Twinkie (Frontend Dev)
**What:** Week starts Monday (ISO/UK norm). `SecondaryFont` resolved via `@font-face { src: local('Google+Sans') }` + Google Fonts fallback. `.today` uses dot indicator; `.selected` uses filled background. Warm burgundy palette (`--primary: #8b2635`). Prev-nav uses `pointer-events: none` + `disabled` (belt-and-suspenders). `renderCalendar` clears and rebuilds on every call (no DOM diffing).
**Why:** Restaurant-appropriate aesthetics, reliable cross-browser font rendering, simple predictable render model.

### 2026-04-01: Asset split - CSS and JS extracted from index.html
**By:** Twinkie (Frontend Dev)
**What:** Split `public/index.html` into `public/styles.css`, `public/js/theme.js` (blocking, in `<head>`), and `public/js/calendar.js` (ES module, deferred). No behaviour or visual change.
**Why:** Separation of concerns; `type="module"` gives free implicit defer and module scope; blocking theme script prevents flash of incorrect theme.

### 2026-04-01: Booking form - two-step module architecture
**By:** Twinkie (Frontend Dev)
**What:** Booking form lives in `public/js/booking-form.js` as a separate ES module; `calendar.js` uses dynamic import to load it on date selection. Module-scoped `formState` tracks step and form data. Real-time validation on input events.
**Why:** Clean separation of concerns; lazy-loads form code only when needed; no global state pollution; consistent dark theme throughout.

### 2026-04-01: Blocked times UI pattern
**By:** Twinkie (Frontend Dev)
**What:** Fail-open on API errors (`fetchBlockedTimes` returns `[]`). Re-render entire step 1 on guest count change (clean state, no edge cases). Show actionable no-availability message when all slots blocked (suggests fewer guests or different date). `formState.blockedTimes` kept as top-level derived state.
**Why:** Network failures must not block customers; backend enforces hard capacity limit at creation time. Re-rendering is simple and eliminates stale state risk.

### 2026-04-01: Blocked times test coverage
**By:** Neela (Tester)
**What:** 6 test cases for `GET /api/reservations/blocked-times`: missing params (400), unknown tenant (404), empty state (no blocks), `max_guests=0` (unlimited - never blocks), capacity boundary (slot blocked when sum exceeds limit), time-window boundary (distant slots not blocked). Far-future dates (2099) used to avoid `block_current_day` conflicts.
**Why:** Edge case noted - `max_guests=0` means no concurrent limit, must always return empty `blocked_times`.

### 2026-04-05: Concurrent guest time limit
**By:** Sean (Backend Dev) - requested by James Healy
**What:** Added `concurrent_guests_time_limit INTEGER NOT NULL DEFAULT 120` to Tenants table. New endpoint `GET /api/reservations/blocked-times` computes which time slots would exceed `max_guests` within the time window using `|slotMinutes - reservationMinutes| < concurrent_guests_time_limit`. Returns `{ blocked_times, time_limit_minutes }`. Frontend fetches on date selection and guest count change.
**Why:** `max_guests` is concurrent capacity. Without a time window, the system had no way to calculate overlapping occupancy. Configurable per tenant to match table turnover patterns.

### 2026-04-07T18:48:55Z: No code comments
**By:** James Healy (via Copilot)
**What:** Do not add comments to code changes. No inline comments, no explanatory comments, no JSDoc — unless code is genuinely complex enough that it cannot be understood without a comment.
**Why:** User request — captured for team memory.

### 2026-04-12T19:44:31Z: Planning artifacts location
**By:** James Healy (via Copilot)
**What:** Planning artifacts and working markdown files (plans, design docs, research notes) must be stored in `.squad/temp/` — never in the Copilot session state directory (`~/.copilot/session-state/`).
**Why:** User request — keeps planning docs with the repo and visible to the team.

### 2026-04-06: API logging strategy
**By:** Sean (Backend Dev)
**What:** Removed Hono `logger()` middleware. `console.error` only on genuine errors (D1 write failures, unexpected missing tenant inside POST /reservations). Validation failures log with `z.prettifyError` plus raw body IDs. Business-rule rejections (422) and expected 404s are silent. Log format: `[route-file] VERB description` with context object.
**Why:** James's requirement to log only when things go wrong. Cloudflare Workers tail logs are the target; `console.error` is the correct primitive. No external logging service.

### 2026-04-05: Admin auth foundation
**By:** Sean (Backend Dev)
**What:** Added `AdminUsers` table (migration `0002`) with `failed_attempts` + `locked_until` for in-table rate limiting (10 failures → 15-min lock). PBKDF2-SHA-256 (100k iterations) password hashing and HMAC-SHA256 JWTs via Web Crypto API (`src/utils/auth.ts`). `POST /api/auth/login` route. `adminAuth` JWT middleware sets `userId` + `tenantId` on Hono context. `JWT_SECRET` is a Wrangler secret declared in `src/types/env.d.ts` until `npx wrangler types` is re-run. Auth responses use `{ success, data?, error? }` envelope.
**Why:** Admin dashboard requires authenticated access; pure Web Crypto avoids external dependencies; in-table rate limiting is simpler than a separate attempts table.

### 2026-04-05: Admin API routes
**By:** Sean (Backend Dev)
**What:** Created `src/routes/admin.ts` with `GET/PATCH /me` and `GET/PATCH/DELETE /reservations`, all protected by `adminAuth` middleware. `tenantId` read exclusively from JWT — never from request body, query params, or URL. Double tenant isolation: application-layer pre-fetch + SQL `WHERE id = ? AND tenant_id = ?`. 404 returned for both not-found and wrong-tenant (prevents resource enumeration). `tenant_code` stripped on `PATCH /me`. `signJWT` extended with optional `expiresInSeconds` (default 8h).
**Why:** Tenant impersonation prevention; resource enumeration protection; `expiresInSeconds` extension required by the test suite.

### 2026-04-05: Admin login UI
**By:** Twinkie (Frontend Dev)
**What:** Created `public/admin/` with `index.html` (login page), `styles/admin.css` (warm burgundy design tokens, separate from public widget's stylesheet), `js/auth.js` (`window.AdminAuth` IIFE global). Blocking inline redirect in `<head>` for already-authenticated users. CSS-only loading spinner. Inline error banner with `aria-live="assertive"`. No `window.alert()`.
**Why:** No bundler; IIFE global required for synchronous `requireAuth()` execution; separate CSS tokens prevent coupling between admin and public widget stylesheets.

### 2026-04-05: Admin dashboard (phases 4–7)
**By:** Twinkie (Frontend Dev)
**What:** Created `public/admin/dashboard.html`, `dashboard.js`, `booking-modal.js`, `settings.js`. Native `<dialog>` for modal (browser handles focus trap + Escape). Table + cards dual-render, CSS toggles at 640px breakpoint (clean print always uses table). Settings tab lazy-initialised on first activation. Date arithmetic via `new Date(y, m-1, d)` to avoid timezone drift. Tenant name pre-populated from localStorage cache. `block_current_day` sent as integer `1`/`0`.
**Why:** `<dialog>` handles focus trap and Escape natively; dual render enables clean print; lazy init avoids double `/api/admin/me` call at startup.

### 2026-04-05: Admin test suite (phase 8)
**By:** Neela (Tester)
**What:** Created `test/auth.spec.ts` (10 tests) and `test/admin.spec.ts` (13 tests). `hashPassword` imported at test runtime for seeds (no stale pre-computed hashes). `getAuthToken()` calls real login endpoint. `signJWT` called with `expiresInSeconds: -1` for expired-token test. Tenant isolation returns 404 (not 403). `PATCH /me` immutability verified by DB assertion. Distinct UUID constants per test file to avoid cross-file collisions.
**Why:** Tests written before implementation to drive Sean's phase 1+2 spec; real hash avoids staleness; 404 for isolation prevents resource enumeration.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
