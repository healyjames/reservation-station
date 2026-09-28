---
description: Start new work - research, plan, and signoff
argument-hint: <task-description>
---

# Begin New Work

Task: $ARGUMENTS

## Step 0: Safety Checks

Before starting new work, verify git state:

```bash
git status
git branch --show-current
```

**If uncommitted changes:**

```
Warning: Uncommitted changes detected.
Commit, stash, or discard before starting new work? (y/n)
```

Wait for user to resolve before proceeding.

**If on main with no local commits ahead of origin/main:**

```
You're on main. What type of work is this?
1. feat
2. fix
3. chore
4. refactor
5. spike

I'll create a branch <type>/<kebab-summary> before we start.
```

**STOP and wait for user response**, then create the branch (see Step 1 for the slug) with:

```bash
git checkout -b <type>/<slug>
```

**If not on main or a feature branch:**

```
Warning: Currently on branch '<branch-name>', not main.
Switch to main before starting new work? (y/n)
```

## Step 1: Generate Task Slug

Generate a folder name for this task:

1. Pick a `<type>` from: `feat`, `fix`, `chore`, `refactor`, `spike` (infer from the task description, or ask if genuinely ambiguous).
2. Generate a kebab-case slug from the task description.
3. Combine: `<type>-<slug>` (e.g., `feat-add-waitlist`). This mirrors the branch name (`<type>/<slug>`) but uses a hyphen instead of a slash, since the folder lives on disk.
4. **Validate:** only lowercase alphanumeric and hyphens, max 60 chars. **Reject:** any path separators (/, \, ..)

Present to user:

```
Creating plan directory: .claude/temp/<slug>/
Is this name ok? (press 'y' to confirm, or type a different name)
```

Wait for user confirmation or alternative name.

## Step 2: Create Directory

Check if directory already exists:

```bash
ls .claude/temp/<slug> 2>/dev/null
```

**If directory exists:**

```
Plan directory '.claude/temp/<slug>/' already exists.
Options:
1. Use a different slug
2. Resume existing plan (/resume)
```

Do not overwrite existing plans.

**If directory doesn't exist:**

```bash
mkdir -p .claude/temp/<slug>
```

### Create status.md

After creating the directory, create `.claude/temp/<slug>/status.md` using the template defined in `/status` ("Creating status.md" section).

- Set `work_status` to `research` (about to start research phase)
- Set `task_type` from Step 1
- Set `branch` from `git branch --show-current`
- Set `created` to today's date
- Set `name` to a human-readable version of the task description
- Set `summary` to a one-line summary of the task

## Step 3: Research Phase

Use the `researcher` agent to explore the codebase.

Provide the agent with:

- The task description
- Output path: `.claude/temp/<slug>/research.md`

The researcher will:

- Read docs (`BUSINESS_LOGIC.md`, `documentation/DATA_MODEL.md`, `AGENTS.md`), ADRs, plans, vision files
- Find relevant code
- Identify patterns to follow
- Document findings in research.md

## Step 4: Planning Phase

Use the `planner` agent to create the implementation plan.

Provide the agent with:

- The task description
- Path to research.md
- Output path: `.claude/temp/<slug>/plan.md`

The planner will:

- Break work into subtasks (small, committable steps)
- Define goals and files for each subtask
- Capture acceptance criteria, drafting them and confirming with you
- Create trackable checklists

Then the plan is verified (the `verify-plan` skill) before signoff.

## Step 5: Signoff

Run /signoff to present the research and plan for user approval. This will show the user clickable file paths and wait for their response.

Do NOT proceed without signoff.

## Rules

- NEVER skip research or planning phases
- NEVER proceed past signoff without explicit approval
- If research or planning raises questions, ask them before signoff
- If the task touches `Tenant`, `Reservation`, `AdminUser`, `BlockedDate`, or `OpeningHours`, the researcher and planner must reason about `documentation/DATA_MODEL.md` and `BUSINESS_LOGIC.md` first (per CLAUDE.md's Data First rule)

## Tracking

- **plan.md checkboxes**: Track cross-session progress (persistent)
- **TodoWrite**: Track in-session subtasks (ephemeral, for complex phases)
