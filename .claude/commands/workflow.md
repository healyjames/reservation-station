---
description: Show the development workflow and available commands
---

# Development Workflow

Present the following workflow guide to the user:

```markdown
## Workflow Overview

### Setup

| Command    | Description                                                                      |
| ---------- | --------------------------------------------------------------------------------- |
| `/install` | Configure forge-workflow for your project (scan codebase, update files)          |
| `/customize` | Add or update a workflow piece (skill/command/agent) to fit your team |
| `/attribution` | Record what shaped the workflow (attribution vs resources) in ATTRIBUTION.md |
| `/clarify` | Interview me to pin down missing info/decisions (or build a guideline doc) |
| `/recalibrate` | Turn this session's corrections into proposed workflow-file updates |

### Starting work

| Command              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `/begin <task>`      | Start new work — runs research, plan, and signoff automatically |
| `/branch <type> <description>` | Create a feature branch from a short description |
| `/research <topic>`  | Run the research phase only                            |
| `/plan`              | Run the planning phase only                            |
| `/signoff`           | Present research and plan for approval                 |

### Executing work

| Command    | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `/next`    | Execute the next subtask cycle (dev, review, present)          |
| `/dev`     | Implement the current subtask                                  |
| `/review`  | Run code review for current changes                            |
| `/present` | Present changes for user approval                              |
| `/run`     | Run the app locally (Claude-bg vs your terminal)               |

### Resuming work

| Command   | Description                                                     |
| --------- | ----------------------------------------------------------------- |
| `/resume` | Resume an existing plan — picks up where you left off           |
| `/status` | Show the progress dashboard without executing anything          |

### Finishing work

| Command     | Description                                              |
| ----------- | -------------------------------------------------------- |
| `/cr`           | Code review (local or worktree-isolated)             |
| `/double-check` | Independent second opinion from a different AI CLI   |
| `/security`     | Run a security audit                                 |
| `/pr`           | Prepare and create a pull request                   |
| `/slice`        | Decide whether/where to split into mergeable PRs     |
| `/performance`  | Deep performance audit                               |

### Standalone commands

| Command              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `/ticket`            | Turn investigation findings into a /begin prompt        |
| `/explain <target>`  | Explain how existing code works (not a review)         |
| `/deck`              | Build a self-contained HTML slide deck                 |
| `/workflow`          | Show this command reference                            |

### Optional modules

Only the modules you set up appear. Run `/install` (or `/install <module>`) to add a skipped one later.

| Command      | Module | Description                                         |
| ------------ | ------ | ---------------------------------------------------- |
| `/audit`     | audit  | Deep multi-dimension audit → actionable issue files  |
| `/audit-fix` | audit  | Implement fixes from one audit dimension file        |

Not currently set up for this project: observability (`/logs`, `/fix-logs`, `/dashboard`), release (`/changelog`, `/release`), secrets (`/secret`). Re-run `/install` if you want to add any of these later.

### Tips

- You don't need to call `/dev`, `/present`, or `/signoff` directly — `/next` and `/begin` orchestrate these for you. `/signoff` runs automatically after planning and presents clickable file links for you to review.
- All plan and research files live in `.claude/temp/` — clean up after your PR is merged
- Optional modules are opt-in. Re-running `/install` re-offers any module you skipped, so you can grow the workflow as the project needs it.
- Skills (`.claude/skills/`) hold the review/security/testing/verification rubrics; commands call them for you — you don't invoke skills directly. `/dev` self-verifies (build/lint/test + acceptance criteria) before the approval gate.
- The workflow evolves with you: run `/customize` to add/update a skill/command/agent — and Claude will suggest it when it notices you repeating the same request.
```

## Rules

- This command is informational only — it never modifies anything
- Present the guide clearly and ask if the user has questions
