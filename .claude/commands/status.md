---
description: Show current plan status and progress
argument-hint: <slug> optional
---

# Status

Show the status of work tracked in `.claude/temp/` by reading `status.md` files.

Two modes:

- `/status <slug>` — show and update status for a specific task
- `/status` (no params) — scan all tasks and show a dashboard

## Arguments

$ARGUMENTS — Optional: folder slug to check a specific task.

---

## Mode 1: Single Task — `/status <slug>`

### 1. Find the folder

Search `.claude/temp/` for a directory matching the argument as a substring.

If no match:

```
No task folder found matching '<argument>'.
Run /begin to start new work.
```

If multiple matches, list them and ask user to pick.

### 2. Read status.md

Read `.claude/temp/<folder>/status.md`. If it doesn't exist, create one with defaults (see "Creating status.md" below).

### 3. Update from git

- Check if the branch from status.md exists: `git branch --list <branch>`
- Check if branch is merged to main: `git branch --merged main | grep <branch>`
- If merged and work_status isn't `merged` or `done`, update work_status to `merged`
- Get merged date if available: `git log main --oneline --merges --grep="<branch>" --format="%ai" | head -1`

### 4. Write updated status.md

Save changes back to the file.

### 5. Display

```markdown
## Status: <name>

| Field       | Value           |
| ----------- | --------------- |
| Task Type   | <task_type>     |
| Branch      | <branch>        |
| Work Status | <work_status>   |
| Created     | <created>       |
| Merged      | <merged_date or —> |

### Summary

<summary text>

### Plan Progress

<if plan.md exists, show subtask progress: for each subtask, its title and which of Dev/Review/Present are checked>
```

---

## Mode 2: Dashboard — `/status` (no params)

### 1. Scan all folders

```bash
ls -d .claude/temp/*/ 2>/dev/null
```

For each directory, check if `status.md` exists. Skip directories without one (they're not tracked tasks — e.g., standalone files or non-task folders).

### 2. Update incomplete tasks

For each status.md where work_status is NOT `done`, `complete`, or `cancelled`:

- Run the same git checks as Mode 1
- Update the status.md file

### 3. Display dashboard

```markdown
## Task Dashboard

| Task                     | Work Status | Created    |
| ------------------------ | ----------- | ---------- |
| feat-add-waitlist         | merged      | 2026-09-12 |
| fix-search-ranking-issue  | in-progress | 2026-09-20 |
| chore-media-inheritance   | done        | 2026-08-30 |

### Summary

- **Active:** <N> tasks in progress
- **Review/Merged:** <N> tasks awaiting review or merge
- **Complete:** <N> tasks done or cancelled

<N> tasks are marked done/cancelled and could be cleaned up.
Would you like to review any of these for deletion?
```

Wait for user response. If they say yes, list the done/cancelled folders and let them pick which to delete. Do NOT auto-delete.

---

## Creating status.md

When a status.md needs to be created (either by /status or by other commands like /begin), use this template:

```yaml
---
name: <human-readable task name>
branch: <branch name from git or null>
task_type: <feature | bugfix | housekeeping | spike | refactor>
created: <YYYY-MM-DD>
---

## Status
- work_status: <research | planning | in-progress | review | merged | done | cancelled>
- merged_date: <YYYY-MM-DD or null>

## Summary
<one-line summary of the task>
```

### Work status values

- `research` — research phase started
- `planning` — plan created
- `in-progress` — dev work underway
- `review` — code review phase
- `merged` — PR merged to main
- `done` — QA passed
- `cancelled` — work abandoned

### Determining task_type

- If folder starts with `feat-` → `feature`
- If folder starts with `fix-` → `bugfix`
- If folder starts with `chore-` → `housekeeping`
- If folder starts with `spike-` → `spike`
- If folder starts with `refactor-` → `refactor`
- Otherwise → infer from folder name or ask

---

## Updating status.md

When updating status.md from other commands (/dev, /review, /pr), only update the specific field that changed. Read the file, find the line, replace the value. Do not rewrite the entire file.

Example — updating work_status:

```
Find: `- work_status: <old-value>`
Replace: `- work_status: <new-value>`
```

---

## Rules

- Never auto-delete folders — always let the user decide
- Update status.md files in-place, don't recreate them
- If a status.md is malformed, fix it rather than erroring
- Show clear, actionable output — the user should know what to do next
