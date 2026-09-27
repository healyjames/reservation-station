---
name: verify-plan
description: Critique an implementation plan against the research and the acceptance criteria before work starts — catch missing/incorrect/oversized steps, and draft acceptance criteria if there are none. Use in /plan before signoff, for non-trivial tasks.
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion
---

# Verify Plan (pre-build loop)

Before building, check that the plan is actually complete and correct. This encodes the iteration a
developer would otherwise do by hand before `/next`. Proportional to task size — for a trivial
task, a quick pass; for a complex one, be thorough.

## Critique the plan against

- **The research** — does the plan address what research found (affected files, patterns,
  constraints, shared schemas/types that need updating)? Anything research flagged but the plan
  ignores is a gap.
- **The acceptance criteria** — does every criterion map to at least one subtask? Is there a subtask
  whose only job is to make an untested criterion verifiable?
- **Shape** — subtasks atomic/ordered/buildable (see the `writing-plans` skill); dependencies
  correct; nothing missing (migrations, schema/type updates, tests); nothing out of scope smuggled
  in.

Fix genuine gaps in `plan.md` directly; surface real trade-offs or unknowns to the user rather than
guessing.

## Draft acceptance criteria if missing

If the plan has no acceptance criteria (or there's no clear way to verify the work), **draft a
testable set** from the task description and research. If you can't even draft one, apply the
`clarify` skill to get what you need rather than fabricating criteria. Confirm the draft with the
user, then record it in `plan.md` under `## Acceptance Criteria` so `verify-acceptance` can check
against them.

## Output

A short note: gaps found and fixed, ACs drafted (and where they were stored), and any open
questions for the user — then hand back to `/signoff`.
