---
description: Explain the development workflow and available commands
---

# Development Workflow

Present the following workflow guide to the user:

```markdown
## Workflow Overview

### Starting work

1. **Create a branch** — either manually or run `/branch <TICKET-ID>` to create one from a Jira ticket
2. Run `/begin <task description>` or `/begin <JIRA-ID>`
   - This runs research → plan → signoff automatically
   - If you're on main with a Jira ticket, it will offer to create a branch for you
   - If you're on a branch with a ticket ID, it will fetch Jira context
   - Plan files are saved to `.claude/temp/<ticket-id>-<slug>/`

### Executing work

3. Run `/next` to execute the next subtask in the plan
   - This runs dev → review → present for each subtask
   - You'll be prompted to approve and commit after each subtask
4. Repeat `/next` until all subtasks are complete

### Finishing work

5. Run `/review` for a final review of all changes on the branch
6. Run `/security` for a security audit (recommended for service changes)
7. Run `/pr` to generate a PR description and open the pull request

### Resuming work

If you get disconnected or start a new session:

- `/resume` — finds your plan by ticket ID from the branch name and picks up where you left off

### Standalone commands

| Command                | Use when...                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `/research <topic>`    | You just want to explore the codebase without a full plan      |
| `/jira`                | You want to fetch Jira ticket details for the current branch   |
| `/cr <branch-name>`    | You want to code review another dev's branch without switching |
| `/cr`                  | You want to run a pre-PR sanity check on your current branch   |
| `/logs <service>`      | You want to parse Azure Application Insights log exports       |
| `/changelog <version>` | You need to generate a release changelog                       |
| `/branch <TICKET-ID>`  | You want to create a feature branch from a Jira ticket         |
| `/ticket`              | You want to create a Jira ticket from an investigation         |
| `/status`              | You want to see plan progress without executing anything       |

### Tips

- You don't need to call `/dev`, `/present`, or `/signoff` directly — `/next` and `/begin` orchestrate these for you. `/signoff` runs automatically after planning and presents clickable file links for you to review.
- All plan and research files live in `.claude/temp/` — clean up after your PR is merged
- Claude has full access to `.claude/temp/` and can read any project file without prompting
```

## Rules

- This command is informational only — it never modifies anything
- Present the guide clearly and ask if the user has questions
