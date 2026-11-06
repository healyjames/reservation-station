---
description: Build an owned daisyUI component in src/frontend/shared/components/ui/
argument-hint: <daisyUI component name, e.g. badge>
---

# Build a UI component

$ARGUMENTS — the daisyUI component name as it appears in its docs URL (`https://daisyui.com/components/<name>/`).

Builds the component only. Switching screens over to it is a separate subtask.

1. **Conventions.** Read "UI components" in `.claude/docs/architecture.md`. Copy the shape of `ui/Button/` and `ui/Loading/`.
2. **Consumers first.** Find the screens that will use it: the legacy component it replaces (the mapping table in the active plan, and the inventory in `documentation/UI_COMPONENTS.md`) and its call sites (`grep`). List the variants, sizes and behaviour they actually need, and build only those. If nothing will consume it, stop and ask.
3. **daisyUI source.** Exact class names from the installed version: `node_modules/daisyui/components/<name>.css`. Markup and accessibility notes: the docs page (WebFetch, or ask the user to paste it).
4. **Write** `ui/<Name>/<Name>.tsx`, `index.ts` and `<Name>.test.tsx`. Add it to `ui/index.ts` and add a row to `documentation/UI_COMPONENTS.md` (prop names only, consumers).
5. **Tests.** Apply the `testing` skill.
6. **Verify.**
   - `npx vitest run --config vitest.frontend.config.ts ui/<Name>`
   - `npx tsc --noEmit -p tsconfig.frontend.json` (compare with the error list before your change; only new errors are yours)
   - `npm run build`, then grep the built `dist/assets/*.css` for every literal class in the component's `Record`s
   - `npx prettier --check --end-of-line auto` on the new files
7. **Review.** Apply the `code-review` and `architecture` skills against the conventions.
