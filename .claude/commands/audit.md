---
description: Deep multi-dimension audit of the app, producing actionable issue files
argument-hint: (no arguments needed — single-app project)
---

# Audit

Run a deep, multi-dimension audit of this app, producing a folder of grouped, actionable issue files that `/audit-fix` can consume.

This is a **standalone** workflow. It is never called by `/begin` or `/next`. Use it for an overnight
sweep of the whole codebase — review the files in the morning.

The orchestrator (this session) does light work — resolving scope, spawning agents, writing the index — so you can run this session on a **cheap model** and have each audit agent run on a strong one.

> This is a single-app project (reservation-station), so there is one target: the app itself. See
> `docs/workflow-config.md` (`## Audit`).

## Step 1: Choose model(s)

Use `AskUserQuestion` to ask which model(s) to run the audit agents in (strongest available recommended). `multiSelect: true`. If more than one is chosen, run the full audit once per model and nest output under a `<model>/` subfolder so results can be compared.

## Step 2: Create output folders

Compute today's date as `YYYY-MM-DD` (`date +%F`). Create `.claude/audit/<date>/reservation-station/` (or `.../reservation-station/<model>/` when multiple models).

## Step 3: Dimensions

Each dimension produces exactly one `.md` file, written by one agent. The agent reads the referenced doc(s) first so findings are measured against the project's actual rules, not generic advice.

| File (`<slug>.md`) | What it audits | Reference |
| ------------------ | -------------- | --------- |
| `dead-code` | Unused exports/files/vars, unreachable code, commented-out blocks, unused deps, handlers/routes defined but never wired up | project structure |
| `code-quality` | Adherence to the project's coding guidelines | `docs/coding.md` |
| `type-safety` | Escape hatches: untyped values, unsafe casts, suppressed type errors, missing return types | `docs/coding.md` |
| `potential-bugs` | Logic errors, off-by-one, unhandled null/undefined, incorrect async, date/timezone bugs, floating promises, wrong comparisons | — |
| `error-handling` | Swallowed errors, missing try/catch at boundaries (Hono routes, D1 queries), errors caught but not surfaced | — |
| `security` | OWASP Top 10, hardcoded secrets, missing input validation at trust boundaries, injection, tenant-scoping gaps | the `security-review` skill |
| `performance` | N+1 queries against D1, unbatched calls, redundant fetches, missing caching, large payloads, sync work in loops | — |
| `test-quality` | Coverage gaps on business logic **and** test quality: black-box vs implementation-coupled, misleading names, factory usage | `docs/testing.md` |
| `schema-consistency` | Validation at trust boundaries, `src/schema/index.ts` vs `db/schema.sql` vs `migrations/` drift | `documentation/DATA_MODEL.md`, `docs/coding.md` |
| `dry-duplication` | Constants/lists/mapping logic duplicated across modules that belong in `src/utils`/`src/schema`/`src/types` | `docs/coding.md` |
| `documentation-drift` | `BUSINESS_LOGIC.md` / `documentation/DATA_MODEL.md` out of sync with the code | the target's own docs |
| `accessibility` | The Preact frontend (`src/` UI) — WCAG/ARIA/keyboard/contrast/semantics | `ai-accessibility` plugin if installed, else general WCAG review |
| `dependency-health` | **Repo-level, once per run** — `npm audit`, outdated majors, known CVEs | — |

## Step 4: Fan out the audit agents

Spawn one agent per dimension, in parallel. Run `dependency-health` alongside the rest (it's already repo-level, there's only one target).

- Use `subagent_type: general-purpose` with `model` set to the chosen alias. Optionally use a matching specialist agent (`security-auditor`, `performance`) where one exists — but keep the `model` override so the run stays in the requested model.
- If an output file already exists (re-run), overwrite it.

Give each agent this brief (fill in placeholders):

```
You are auditing reservation-station for the `<dimension>` dimension only.

1. Read the reference doc(s) for this dimension: <refs from the table>.
2. Audit the app's source (src/, migrations/, db/schema.sql, public/, scripts/).
3. Find real, specific issues — cite file:line. Do not invent issues to pad the
   list; an empty section is a valid, good result.
4. Classify each issue High / Medium / Low and estimate effort (S <1h, M 1-4h, L >4h).
5. Write findings to `<output-dir>/<dimension>.md` using the exact template below.

Return only a one-line summary: "<dimension>: H<n> M<n> L<n>".
```

### Output file template (every dimension file must follow this)

```markdown
# reservation-station — <Dimension> Audit

- **Model**: <model> · **Date**: <date> · **Scope**: <paths audited>
- **Totals**: High <n> · Medium <n> · Low <n>
- **Estimated effort**: <rollup>
- **Suggested PR split**: <single PR | describe the groups>

## High

### [H1] <short title>
- **Location**: `path/to/file:123`
- **Issue**: <what is wrong>
- **Why it matters**: <impact / which rule or risk>
- **Fix**: <concrete, enough detail that /audit-fix needs no re-investigation>
- **Effort**: S | M | L
- **Verify**: <how to confirm it's fixed>

## Medium

### [M1] <short title>
... same fields ...

## Low

### [L1] <short title>
... same fields ...
```

If a section has no issues, keep the heading with `_None found._` underneath.

## Step 5: Write the run index

After all agents finish, write `.claude/audit/<date>/_index.md`:

- High/Medium/Low totals across all dimension files.
- A "top priorities" list — the High issues most worth fixing first.
- The exact `/audit-fix reservation-station <dimension>` commands to action each non-empty file.

Then present the index path as a clickable link and a one-paragraph summary.

## Rules

- The orchestrator writes NO code and fixes NOTHING — it only audits and reports. Fixing is `/audit-fix`.
- Every issue must cite `file:line` and be independently actionable. No vague findings.
- Prefer fewer, real issues over a long padded list. An empty dimension file is a good outcome.
- Never commit, push, or branch — this command only writes to `.claude/audit/`.
- Keep each dimension in its own file; do not merge dimensions.
- Present all created paths as clickable absolute paths at the end.
