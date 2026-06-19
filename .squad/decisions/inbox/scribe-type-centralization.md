### 2026-06-19: Type centralization architecture
**By:** James Healy
**What:** Backend shared types live in `src/types/types.ts`. Rule: types used in 2+ files across different directories go there. Zod-inferred types stay co-located with their schemas in `src/db/schema.ts`. Frontend types stay in `src/frontend/shared/types/` and are accessed via the `@shared/types` alias. Component prop types and hook-local types stay in their own files.
**Why:** Eliminates scattered type definitions across utility files; creates a single lookup for shared backend types.
