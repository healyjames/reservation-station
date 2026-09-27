# Coding Guidelines

## Language & style decisions

- Prefer `type` aliases over `interface`. Only use `interface` for declaration merging or class implementation contracts.
- No data mutation — immutable data structures only where possible.
- Pure functions wherever possible.
- No nested if/else — use early returns or composition.
- Prefer options objects over positional parameters.
- Use array methods (`map`, `filter`, `reduce`) over loops.
- Strict TypeScript always. Avoid `any` entirely. When `unknown` is used and the reason isn't obvious, add a comment explaining why.
- Unused parameters required by an interface but not used in the implementation: prefix with `_` (e.g. `_context`).

## Comments

Code should be self-documenting — avoid comments except where the *why* isn't obvious (e.g. explaining a non-trivial regex, or a third-party import quirk). Don't explain *what* the code does.

## Error handling

No project-specific error-handling wrapper is mandated. Validate at trust boundaries with the Zod schemas in `src/schema/`; let internal code trust its inputs.

## Naming & structure

See `docs/architecture.md` for directory conventions (`src/routes`, `src/schema`, `src/db`, `src/utils`, etc.).

## Data & schema consistency

- Any change to a stored column, enum, or constraint must be reflected in **all** of: `db/schema.sql`, the appropriate file in `migrations/`, `src/schema/index.ts`, and `documentation/DATA_MODEL.md` — in the same change.
- Never edit an already-applied migration — add a new one and update `db/schema.sql` to match the end state.
- Foreign keys, unique constraints, cascade rules, and tenant scoping must never be weakened or bypassed.

## Repo DRY principles

When the same constant, list, or logic appears in multiple places, extract it to `src/utils/`, `src/schema/`, or `src/types/`. This especially applies to:

- Filter/exclusion lists used across routes
- Enum values or string unions shared between producer and consumer code
- Mapping logic duplicated across modules

When extracting a shared constant, verify it matches **all** existing inline usages — a missed value is a behavioural regression.

## Formatting

Prettier config (`.prettierrc`): printWidth 140, single quotes, semicolons, 2-space indent. There is no `npm run format` script — run `npx prettier --write .` / `npx prettier --check .` directly. No linter (ESLint/Biome) is currently configured.

## Banned / discouraged

- `any` — use precise types or `unknown` with a comment.
- Nested if/else — prefer early returns.
- Mutating arrays/objects in place — prefer `map`/`filter`/`reduce`/spread.
- Editing an already-applied migration file.
- Unscoped (missing `tenant_id`) queries against tenant-owned tables.
