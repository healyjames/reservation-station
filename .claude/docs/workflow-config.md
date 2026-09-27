# Workflow Configuration

## Project
- **Language:** TypeScript (strict)
- **Framework:** Cloudflare Workers + Hono (backend), Preact + Vite (frontend)
- **Monorepo:** No (single app)
- **Package manager:** npm

## Commands
- **Test:** npm run test (Vitest — `test/**/*.spec.ts` backend via `@cloudflare/vitest-pool-workers`, `src/frontend/**/*.test.tsx` frontend)
- **Test (frontend only):** npm run test:frontend
- **Lint:** none configured
- **Format:** npx prettier --write .
- **Format check:** npx prettier --check .
- **Build:** npm run build
- **Deploy:** npm run deploy (`vite build && wrangler deploy`)

## Ticket Tracker
- **System:** None
- **Notes:** No ticket tracker is configured for this project. Task slugs use `<type>-<slug>` (e.g. `feat-add-waitlist`) instead of a ticket ID.

## Git
- **Hosting:** GitHub (`healyjames/reservation-station`)
- **Default branch:** main
- **Branch convention:** `<type>/<kebab-case-summary>` (e.g. `feat/lead-delay`), matching this repo's existing history

## Working Directories
- **AI temp files:** .claude/temp/
- **AI docs:** .claude/docs/

## Modules
- **observability:** n/a
- **audit:** installed
- **release:** n/a
- **secrets:** n/a

## Audit
- **Targets:** reservation-station (single app — no monorepo split)
- **Output:** .claude/audit/<date>/

## Commit Guard
- **Hook:** installed (`.claude/hooks/commit-guard.sh`, PreToolUse) — blocks `git commit`/`git push` from Claude

## Forge Workflow
- **Version:** 1.2.0
