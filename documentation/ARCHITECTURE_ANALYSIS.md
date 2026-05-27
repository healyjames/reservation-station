# Architecture Analysis

_Date: 2026-05-27_

## Scope

Reviewed the repository structure from the repo root using `tree`, then checked the current frontend, backend, config, migration, public asset, and Squad decision files.

Cloudflare references used for comparison:
- Workers docs: static assets are best deployed as part of the same Worker and should keep static files separate from application logic.
- Current React guidance: Worker API + Vite frontend is a valid full-stack pattern on Workers.
- Current limits: this project is nowhere near bundle or asset-count limits, so there is no architectural pressure to split into multiple Workers.

## Executive Summary

The broad shape is sound:
- `src/` owns Worker/API code.
- `src/frontend/` owns the Preact application surfaces.
- `src/frontend/shared/` is the right place for reusable hooks, types, and components.
- `wrangler.jsonc` + `vite.config.ts` are placed where a Cloudflare/Vite project expects them.

The main architectural issue is not the existence of `booking-widget/`.
The main issue is that the repo is currently in a mixed transitional state:
- new Preact surfaces live under `src/frontend/`
- legacy vanilla assets still live under `public/`
- `dist/` ships both worlds together
- `src/frontend/index.html` exists, but the built root page is still the legacy `public/index.html`

So the structure is directionally correct, but ownership of the public-facing surfaces is still split.

## Current Structure Overview

### Backend

- `src/index.ts` exports the Worker entry.
- `src/app.ts` mounts the Hono app and all `/api/*` routes.
- `src/routes/` contains route modules for `tenants`, `reservations`, `auth`, `admin`, `blocked-dates`, and `opening-hours`.
- `src/db/` contains schema definitions and SQL.
- `migrations/` contains flat, sequential D1 migrations.

This is a good Cloudflare Worker layout: runtime entry is small, route mounting is centralized, and D1 schema concerns are kept out of route files.

### Frontend

`src/frontend/` is now split into:
- `shared/` for reusable runtime code
- thin surface folders:
  - `booking-widget/`
  - `admin/`
  - `cancel/`
  - `booking/manage/`

Each surface is minimal and mostly contains:
- `index.html`
- entry `.tsx`
- top-level `App` component

That is a good multi-surface Preact pattern. It keeps the route/bundle boundary at the edge and keeps reusable logic out of the entry folders.

### Static assets and build output

- `public/` still contains fonts, CSS, theme bootstrap, and legacy JS/HTML.
- `dist/` contains generated Preact bundles and copied public assets.
- `wrangler.jsonc` serves `dist/` as the static assets directory.

This is valid on Workers, but right now `public/` is doing two jobs:
1. real static assets
2. old application surfaces

That is the biggest structural blur in the repo.

### Config

- `wrangler.jsonc`, `vite.config.ts`, `tsconfig.json`, and Vitest config files are all in sensible root-level locations.
- `vite.config.ts` is clearly set up as a multi-entry frontend build.
- `wrangler.jsonc` correctly points Worker runtime to `src/index.ts` and assets to `dist/`.

## What Is Working Well

### 1. Shared-first frontend structure is the right direction

The move to `src/frontend/shared/` is a good architectural decision.
It reduces duplication and makes the surface folders honest: they are entry points, not feature silos.

### 2. `booking-widget` is correctly treated as a surface entry

`booking-widget/` should stay a surface folder, not be flattened into a generic shared component folder.

Why:
- it has its own HTML document
- it has its own bundle entry
- it is independently routable/deployable
- it represents a public product surface, not just a reusable leaf component

The reusable parts of that surface already live in the correct place: `shared/components/BookingWidget/`.
That split is healthy.

### 3. Other surface-specific folders are also correctly modeled as surfaces

The same logic applies to:
- `admin/`
- `cancel/`
- `booking/manage/`

These are not merely components. They are separate application surfaces with their own URL entry, bootstrap concerns, and page-level state.

### 4. Backend simplicity is mostly good

The Worker remains small, routes are flat, and D1 usage is mostly prepared-statement based. That matches the right bias for Workers + D1: simple queries, thin handlers, no unnecessary service explosion.

### 5. Config placement is good

Nothing is hidden in unusual directories. The repo is easy to orient on.

## What Could Be Improved

### 1. Resolve the mixed legacy/new frontend ownership

Right now the repo still serves both:
- legacy vanilla surfaces from `public/`
- new Preact surfaces from `src/frontend/`

Concrete signs of that split:
- `public/index.html` is still the built root page in `dist/index.html`
- `src/frontend/index.html` exists but is not the canonical root build entry
- `public/admin/` and `public/js/*.js` are still copied into `dist/`
- new Preact admin/cancel/manage/widget bundles are also emitted into `dist/`

This is manageable during migration, but it should not become the permanent shape.

### 2. `src/frontend/index.html` is currently ambiguous

The file suggests an intent for the Preact booking widget to own the root surface, but the actual built root still comes from `public/index.html`.

That means the repo currently has two competing ideas of the public booking entry:
- root legacy page
- Preact `booking-widget` page

That ambiguity is more important than the folder name.

### 3. Static assets vs application code should be cleaner

Best practice on Workers is:
- keep immutable/static assets in `public/`
- keep application logic in `src/`

This repo still has legacy application behavior in `public/js/` and legacy page ownership in `public/admin/` and `public/index.html`.

That is acceptable during migration, but the steady-state target should be:
- `public/` for fonts, static CSS, tiny bootstraps only if truly static
- `src/frontend/` for active frontend application surfaces

### 4. `assets.not_found_handling = "single-page-application"` does not perfectly match the current app shape

Cloudflare recommends SPA fallback for SPA routing.
This repo is no longer a single SPA. It is a multi-surface app with discrete HTML entry points.

Current behavior risks unmatched paths falling back to the root page when a 404 would be more correct.

For this structure, a better long-term fit is either:
- a 404-oriented assets setup, or
- explicit selective routing if there is a deliberate reason to keep SPA fallback

### 5. API response shape is still inconsistent

Han's desired contract is `{ success, data?, error? }`, but current route behavior is mixed:
- some routes return `{ success: true, data: ... }`
- some return raw arrays or raw objects
- error responses are usually `{ error: ... }`

The backend layout is good, but the cross-cutting response contract is not yet consistently enforced.
This will matter more as frontend surfaces continue to share clients and hooks.

### 6. Local dev/test structure needs tightening

The repo builds successfully, but test structure shows two problems:
- frontend tests pass cleanly
- worker tests currently fail because the D1 test database schema is not applied before execution
- the worker Vitest config also picks up jsdom frontend tests, which do not belong in the Cloudflare worker pool

That is not a folder-structure crisis, but it is an architecture/ownership issue in repo tooling.

## Booking Widget Recommendation

## Short answer

Yes: `src/frontend/booking-widget/` is correctly placed as a frontend surface.
No: it should not be demoted to "just a component".

## Why

A component is something other surfaces embed inside their runtime tree.
A surface is something that owns:
- an HTML entry
- a bundle boundary
- page bootstrap
- URL/query-string conventions
- standalone loading/error states

`booking-widget` clearly has surface responsibilities.

The component-level pieces are already in the right place:
- `shared/components/BookingWidget/*`

So the current split is actually the correct one:
- `booking-widget/` = surface entry
- `shared/components/BookingWidget/` = reusable UI parts for that surface

## Recommendation for the other folders

Treat these the same way:
- `admin/` = surface
- `cancel/` = surface
- `booking/manage/` = surface

That is the right mental model.

If the naming feels awkward, the improvement is naming, not responsibility.
For example, a future cleanup could move these under:
- `src/frontend/surfaces/booking-widget`
- `src/frontend/surfaces/admin`
- `src/frontend/surfaces/cancel`
- `src/frontend/surfaces/booking-manage`

But that is optional. The current structure is understandable.

## Best Practices Comparison

### Cloudflare Workers + Pages / static assets

**Good:**
- single Worker entry for API logic
- static assets deployed with the Worker from `dist/`
- no unnecessary multi-Worker split
- current bundle size/profile is comfortably below Workers limits

**Needs adjustment:**
- current asset fallback is SPA-oriented while the frontend is now multi-surface
- legacy public app code is still mixed into deployed assets

### Preact/React organization

**Good:**
- thin entry points
- shared hooks/types/components in one place
- multi-entry build for distinct surfaces

**Needs adjustment:**
- clarify which surface owns the root public route
- reduce duplicate entry shells during migration

### Frontend/backend separation

**Good:**
- API code is in `src/`
- frontend code is in `src/frontend/`
- shared frontend runtime code is not mixed into backend files

**Needs adjustment:**
- shared API response shape should be standardized so frontend hooks do not have to infer route-specific contracts

### Build tooling and config placement

**Good:**
- root-level Vite/Wrangler/TS config is conventional
- Vite multi-entry config is easy to reason about

**Needs adjustment:**
- consider adopting the Cloudflare Vite plugin later if local runtime parity becomes more important than the current split `wrangler dev` + Vite proxy approach
- not urgent, but the current Cloudflare recommendation is trending toward tighter Vite/Worker integration

### Static assets vs dynamic code

**Good:**
- fonts and global CSS are in sensible asset locations

**Needs adjustment:**
- active frontend application code should eventually stop living in `public/js/`
- `public/` should stop owning legacy pages once the Preact replacements are accepted

## Recommended Refactors

### Priority 1 — pick one canonical public booking entry

Choose one of these and make it true everywhere:

**Option A: root page becomes the Preact widget**
- make the Preact booking surface the canonical `/`
- remove the legacy `public/index.html`
- either promote `src/frontend/index.html` to the real entry or fold `booking-widget/index.html` into the root entry

**Option B: keep `booking-widget/` as a named surface**
- keep `/booking-widget/` as the canonical Preact widget route
- remove or clearly document `src/frontend/index.html`
- make it explicit that root `/` is legacy or marketing shell, not the widget surface

For this repo, Option A looks cleaner unless there is a product reason to keep `/booking-widget/` separate.

### Priority 2 — finish the surface migration

Once verified, remove legacy surface ownership from `public/`:
- `public/admin/*`
- legacy page JS in `public/js/` that has Preact replacements
- legacy root HTML if the Preact widget becomes canonical

### Priority 3 — fix runtime contract consistency

Standardize route responses to the agreed envelope:
- success: `{ success: true, data }`
- failure: `{ success: false, error }`

Do this before more shared frontend hooks accumulate route-specific parsing logic.

### Priority 4 — fix test boundary separation

- worker Vitest config should only run worker tests
- frontend Vitest config should only run jsdom/frontend tests
- worker test setup should apply schema/migrations before execution

## Final Recommendation

The project is broadly on the right architecture now.
The shared-first Preact structure is good, and `booking-widget` is correctly modeled as a surface entry rather than a plain component.

What should change is not that folder's existence.
What should change is the remaining ambiguity between legacy public assets and the new Preact surfaces.

If James wants the cleanest long-term shape, the next architectural cleanup is:
1. make one Preact surface the canonical public booking entry
2. stop shipping legacy page ownership from `public/`
3. keep all active frontend surfaces as thin entries over `shared/`
4. standardize API envelopes across routes

## Validation Notes

- `npm run build` passed.
- Frontend Vitest suite passed: 98/98 tests.
- Worker Vitest suite is currently failing due to test-environment setup, not due to this analysis work: D1 schema is not applied before the worker tests run, and the worker config is also catching jsdom frontend tests.
