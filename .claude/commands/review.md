---
description: Run review phase for current changes
---

# Review Phase

## Prerequisites

Requires changes to review:

- Active plan with current subtask Dev complete
- Or uncommitted/unstaged changes to review
- This may be called outside of our cycle, in which case ignore the sections about plan.md

## Instructions

This will be called after a subtask as part of a plan has been completed, or after all subtasks on a plan have been completed.

Run review cycle on current changes :

### 1. Code Review

Use `pr-sanity-check` agent:

- Reviews implementation, design, tests
- Classifies issues by severity
- Suggests fixes

**Critical (must fix):**

- Security vulnerabilities
- Data loss risks
- Breaking changes without migration
  → Prompt user, then fix immediately, re-run reviewer

**High (should fix):**

- Bugs causing incorrect behavior
- Missing error handling
- Architectural violations
  → Prompt user, then fix immediately, re-run reviewer

**Medium (address):**

- Code smells
- Missing edge case tests
- Minor performance concerns
  → Prompt user then fix if straightforward, or note for Present

**Low (optional):**

- Style preferences
- Minor improvements
  → Note for user, don't block

### 2. Re-review Loop

After fixing Critical/High issues:

- Re-run code-reviewer
- Repeat until no Critical/High issues remain

### 3. Update Plan and Status

Check `- [x] Review` in plan.md for this subtask.

Also update `status.md` in the same task directory: set `work_status` to `review`.

## After Review

```
Review complete for subtask <N>: <title>

Results:
- Critical: 0
- High: 0
- Medium: <N> (noted for Present)
- Low: <N> (noted for Present)

Run /present to continue.
```

## Rules

- ALWAYS run pr-sanity-checks
- NEVER proceed with Critical or High issues unresolved
- Fix and re-review until clean
- Document remaining Medium/Low for user visibility
- Update plan.md checkbox when complete

## Note

Security audit (`security-auditor` agent) runs separately before PR via `/security`.
This keeps per-commit reviews fast while ensuring comprehensive security review of all changes.

## Logging Review

If the changes touch service handlers, consumers, or business logic, verify logging compliance with `docs/logging-strategy.md`:

- New/modified logs include `productId`, `entityType`, `brand`, `pipeline` dimensions
- Business logic decisions that change product outcomes log with a `reason`
- Logger names follow `{service-name}:{module-name}` format
- No temporary `[TEMP]` logs left in the changes

Flag logging issues as Medium severity.

## Dashboard Impact Check

If the changes modify log statements (`.info(`, `.error(`, `.warn(`, `.debug(`, `logger.`), check whether any dashboard KQL tiles depend on the changed logs.

### How to check

1. Read `docs/dashboard-dependencies.json` — this maps every dashboard tile to the message patterns, dimensions, logger names, and source files it depends on.
2. For each changed file that appears in a tile's `sourceFiles`, check:
   - **Message text changed?** — If the log message string was renamed, the dashboard tile using `message contains "..."` will silently return zero results.
   - **Dimension key renamed/removed?** — If a `customDimensions` key the tile queries was removed or renamed, the tile column will be empty.
   - **Logger name changed?** — If a `createLogger('...')` name was changed and a tile filters by `log.logger`, it will miss the logs.
   - **Pipeline value changed?** — If the `pipeline` dimension value was changed, tiles filtering by `Pipeline == "..."` will miss the logs.
3. For each changed file NOT in any tile's `sourceFiles`, check whether the log message patterns match any tile's `messagePatterns`. New code could produce messages that existing tiles pick up (usually fine) or clash with existing queries (check for false positives).

### Severity

- **Medium** — A dashboard tile's KQL will break or return incorrect results due to this change.
- **Low** — A dashboard tile might benefit from updating to include a new log pattern, but nothing breaks.

### Output format

For each flagged issue:

```
Dashboard impact: <dashboard-name> → <tile-name>
  Changed: <what was changed in the log statement>
  Effect: <what happens to the tile — e.g. "returns zero results", "missing column">
  Fix: <what to update in the dashboard KQL and/or docs/dashboard-dependencies.json>
```

If the dashboards are deployed as Bicep in IaC, note that the Bicep definition will also need updating. Suggest the KQL fix first (for testing), then the Bicep location if known.

### When no impact

If changed files contain log statements but none appear in the dependency registry and no message patterns match, no action needed — just note "Dashboard impact: none detected".
