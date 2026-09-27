---
name: writing-plans
description: How to break work into a good implementation plan for this workflow — atomic reviewable subtasks, the plan.md structure, acceptance criteria, and the checklist vocabulary. Use when creating or revising a plan.
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion
---

# Writing Plans (method)

Turn research + a task into a `plan.md` of small, independently reviewable steps.

## Subtask sizing

Each subtask should be **atomic** (one logical thing), **reviewable** in isolation, **buildable**
(the code compiles/runs after it), and **ordered** (dependencies first: types → data → logic →
API → integration → tests). Too small = "fix typo"; too large = "implement the whole feature".

## plan.md structure

Metadata (task, branch, status, created) → Summary → **Acceptance Criteria** (see below) →
Subtasks → Dependencies → Risks → Out of Scope → Notes.

Each subtask carries a Goal, the Files it touches, and the canonical checklist:

```
- [ ] Dev
- [ ] Review
- [ ] Present
```

(Commit is a user action, not a checkbox.)

## Acceptance Criteria (how we verify "done")

A plan needs a way to verify it worked. Capture acceptance criteria as a testable checklist near
the top of `plan.md`:

```
## Acceptance Criteria
- [ ] <observable, testable outcome>
- [ ] <observable, testable outcome>
```

- This project has no ticket tracker, so **draft acceptance criteria** from the task description and
  research, then confirm them with the user before recording them in `plan.md`. These criteria are
  what the `verify-acceptance` skill checks the implementation against.

## Guardrails

- Stop and ask (via `AskUserQuestion`) on genuine unknowns or when multiple valid approaches have
  real trade-offs — don't guess.
- Add test subtasks (or a final test subtask for small work) per the `testing` skill.
- Never plan a commit step — the user commits.
