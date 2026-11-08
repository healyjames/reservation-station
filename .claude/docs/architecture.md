# Architecture Guidelines

## Pattern

**Data-first, feature-organized Cloudflare Worker.** There is no formal hexagonal/layered split —
the architecture is driven by the data model (`documentation/DATA_MODEL.md`), not by a ports-and-
adapters or layered convention. Every feature is a thin projection of the underlying objects
(`Tenant`, `Reservation`, `AdminUser`, `BlockedDate`, `OpeningHours`).

- **Backend:** a single Cloudflare Worker (Hono) serving both the API and, via Vite, the frontend
  bundle. `src/app.ts` wires the Hono app; `src/index.ts` is the Worker entrypoint.
- **Frontend:** Preact, built with Vite, organized by app area under `src/frontend/`
  (`admin`, `booking`, `booking-widget`, `cancel`) plus a `shared` component library.

## Boundaries & dependency rules

- **Data first, always.** Any change touching a stored field must update `db/schema.sql`, the
  relevant file in `migrations/`, the Zod schema in `src/schema/index.ts`, and
  `documentation/DATA_MODEL.md` together — never one without the others. This is the project's
  primary invariant (see CLAUDE.md's "Data First" section).
- **Multi-tenancy is load-bearing.** Every table except `Tenants` carries a `tenant_id` FK with
  `ON DELETE CASCADE`. Any query or handler touching `Reservation`, `AdminUser`, `BlockedDate`, or
  `OpeningHours` must be scoped to the current tenant — an unscoped query is a cross-tenant data
  leak, not just a bug.
- **Validation at trust boundaries.** Zod schemas in `src/schema/` are the runtime contract for
  anything crossing a trust boundary (API request bodies, the public booking widget). Internal
  logic can use plain TypeScript types.
- **No separate Customer entity.** Customer details are embedded inline on each `Reservation` —
  don't introduce a Customer table or treat customer data as a shared/joinable entity.

## Where things go

- `src/routes/` — Hono route handlers (HTTP boundary; parse/validate input, call into logic, shape the response)
- `src/schema/` — Zod schemas; the validation contract at trust boundaries
- `src/db/` — D1 query helpers
- `src/middleware/` — Hono middleware (auth, tenant resolution, etc.)
- `src/emails/` — transactional email templates/sending
- `src/constants/` — shared constants (see CLAUDE.md's DRY Principles)
- `src/types/` — internal TypeScript types (not trust-boundary validation)
- `src/utils/` — shared pure helpers
- `src/frontend/shared/` — reusable Preact components used across the admin/booking/cancel apps
- `src/frontend/shared/components/ui/` — owned daisyUI components (see "UI components" below)
- `src/frontend/shared/styles/` — `app.css` (Tailwind + daisyUI entry, imported only by the app entry `.tsx` files) and `themes.css`
- `src/frontend/{admin,booking,booking-widget,cancel}/` — the individual frontend apps
- `db/schema.sql` — physical table definitions (end-state)
- `migrations/` — ordered, incremental SQL changes applied to production (never edit an applied one — add a new one)
- `documentation/DATA_MODEL.md` — canonical description of what's stored and why

## UI components

Owned daisyUI 5 components: the code lives in `src/frontend/shared/components/ui/` and we edit it, shadcn-style; nothing is imported prebuilt. Inventory: `documentation/UI_COMPONENTS.md`. Build new ones with `/ui-component <name>`.

- **Files:** `ui/<Name>/<Name>.tsx` (default export), `index.ts` (re-exports the default and the prop types), `<Name>.test.tsx`. Add to the `ui/index.ts` barrel and the inventory. Icons go in `ui/icons/` and are imported from `@shared/components/ui/icons`, never re-exported from the `ui` barrel (names like `Menu` and `X` would clash with components).
- **Props:** `type <Name>Props = Omit<JSX.<El>HTMLAttributes<HTMLXElement>, OwnedAttributes> & { class?: string; ... }`. `OwnedAttributes` lists every attribute the component sets itself; `class` and `className` (this narrows Preact's `string | Signal` class type, so `cx()` needs no cast); any HTML attribute whose name is reused as a prop with a different type (e.g. `size`); and `children` if the component owns its content.
- **Render:** one root element. Spread `{...rest}` first, then the owned attributes, then `class={cx(..., className)}`. TypeScript never type-checks hyphenated JSX attributes, so owned `aria-*` attributes are also cleared at runtime (`aria-label={undefined}`). `cx` comes from `@shared/utils/cx`.
- **Variants:** union props mapped through a `Record<Variant, string>` of complete literal class strings. Never `btn-${variant}`: Tailwind's scanner cannot see interpolated names. Build only the variants a current screen uses; daisyUI emits CSS for every class it finds, and it ships to every page, the public widget included. The default size maps to no modifier class; the default variant may map to the legacy default look. When a variant's name or look differs from the legacy one or from the daisyUI class of the same name, say so in a one-line comment above the `Record` and in the inventory row (e.g. Button's `secondary` → `btn-outline`).
- **Styling:** daisyUI and Tailwind classes only. No CSS modules, and no inline `style` except computed positioning.
- **State:** exposed through role, `aria-*` or `data-*`, never only through a class. Tests query by role, label, text or `data-*`, never by class name.
- **Live regions:** components with a live role have an announcing mode and a decorative mode (e.g. `label={null}`). Announcing puts the label in visually hidden text content, not `aria-label`. A live region mounted together with its content is best-effort for NVDA/JAWS; when an announcement must be heard, the page keeps a persistent region and changes its text.
- **Busy and disabled:** disabling a focused control drops focus to `<body>`. The consumer moves focus to the result or status message when the request finishes.
- **Themes:** `shared/styles/themes.css`; `public/js/theme.js` sets `<html data-theme>` from `?theme=`/`?mode=` before first paint (admin: `admin-<mode>`, ignoring `?theme=`).

## Anti-patterns (reject in review)

- A route handler that queries `Reservation`/`AdminUser`/`BlockedDate`/`OpeningHours` without a
  `tenant_id` filter.
- A schema/enum value used in code that isn't reflected in `src/schema/index.ts` (or vice versa).
- Editing an already-applied migration file instead of adding a new one.
- Introducing a persistent Customer entity instead of keeping customer details embedded on `Reservation`.
