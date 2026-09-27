# Development Guidelines for Claude

> **About this file:** This is a modular version with detailed documentation loaded on-demand. The main file (this one) provides core principles and quick reference. Detailed guidelines are in separate files imported via `@~/.claude/docs/...`.

# Git Operations Policy

⛔ **NEVER commit or push to git without explicit user request**

- DO NOT run `git commit`, `git push`, or `git add` unless explicitly asked
- Code changes and file modifications are fine
- User will handle all git operations (commits, pushes, etc.)
- Exception: Branch operations like checkout may be acceptable when instructed
- Never fetch or read **production** secret values — dev/test only. Adding secrets to any environment is fine.
- If you keep asking for the same step, or keep adding the same acceptance criterion, say so — run `/customize` to encode it as a workflow piece, or `/recalibrate` to turn session corrections into proposed updates.
- When a shared resource (a blog, doc, or someone's file) shapes a skill/command/agent, apply the `attribution` skill.

# About the app

This is a general purpose Claude file, details about this repo itself are in ./README.md and ./BUSINESS_LOGIC.md
Please make sure you read the package.json to understand what technology we are using for this app.

Before commencing a session, always read `BUSINESS_LOGIC.md` file and retain the information as context. Any changes to business logic in the code must be reflected in that file.

# Data First

**This is a data-focused project. Nothing works if the data doesn't.** The data model is the foundation — every feature, endpoint, and UI is a projection of the underlying objects (`Tenant`, `Reservation` with its embedded customer, `AdminUser`, `BlockedDate`, `OpeningHours`).

- The source of truth for the data model is `documentation/DATA_MODEL.md`. Read it at the start of any session and treat it as canonical for what we store and why.
- **Preserving data structure and integrity is the top priority.** Foreign keys, unique constraints, cascade rules, and the tenant scoping must be respected in every change. Do not weaken or bypass them.
- The physical schema (`db/schema.sql`), the migrations (`migrations/`), and the Zod validation schemas (`src/schema/index.ts`) must always agree. A change to any column, enum, or constraint must be reflected across all three **and** in `documentation/DATA_MODEL.md`, in the same change.
- Never edit an already-applied migration — add a new one and update `db/schema.sql` to match the end-state.
- When considering any feature, reason about the data first: what objects and columns does it touch, and does it keep the model consistent?

# Coding guidelines

See `@.claude/docs/coding.md` for the full ruleset (style decisions, DRY principles, formatting, banned patterns). The `code-review` skill reads it during reviews.

# Architecture

See `@.claude/docs/architecture.md` for how this Worker/Preact app is organized, its multi-tenancy boundary rule, and where new code should go. The `architecture` skill enforces it during reviews.

# Formatting

The repo uses Prettier for code formatting. Before submitting changes, always check ./.prettierrc. There is no `npm run format` script — run `npx prettier --write .` / `npx prettier --check .` directly. No linter is currently configured.

**EditorConfig rules:**

- 2-space indentation
- UTF-8 charset
- Insert final newline
- Trim trailing whitespace
- Markdown: preserve whitespace, no line length limit

# Planning and executing work

When making changes, please make a _-plan.md file (where you name it appropraitely) with a checklist. Always go back and update this file, either checking off as you go along, or changing the checklist if you are asked for changes.
When asked for an audit, make a single file at _-audit, and again, keep this up to date or ammend by adding to the end after we have made updates, rather than making multiple files.
All .md files should be saved to ./ai unless specified otherwise. It will then be up to the user to move these to other folders when they are considered ready.

# Testing

See `@.claude/docs/testing.md` for the full ruleset (method, coverage philosophy, black-box testing, mocking, predict-then-verify). The `testing` and `code-review` skills read it.

# Teach

If the developer is unclear about how something works, please use the agents/teach-mode.md agent to help give them better context, examples, and links to documentation.

# Permissions

**Reading files:** Claude has full permission to read any file in this project without asking. Never prompt for read permission.

**`.claude/temp/` folder:** This folder is Claude's workspace. Claude has full permission to create, read, write, edit, and delete files in `.claude/temp/` without asking. This includes creating subdirectories, writing plan/research files, and any other AI working files. Never prompt for permission for any operation in this folder.

# .MD Files

Whenever creating .md files, whether it was requested by the developer, created by claude/cursor for documentation or context retention, or to track progress, always save it into .claude/temp/
The developer will decide whether this file should continue to live in the repository after the feature is complete. These files are written for AI first, and so a developer should think about rewriting it for developers if the intention is to keep it in the repo.
Developers need to be responsible for the files they leave in .temp across PRs and commits, but you need to make sure that they are named correctly.
Keep docs concise. Do not write the same thing in multiple ways. If it is intended for human use, make sure to keep it short enough for human retention. If it is intended for AI use, prepend -ai to the end of the name. If the user has requested the doc to be written specifically as documentation, save it to /docs rather than .claude/temp

**Clickable links:** After writing any `.md` file, always present it to the user with its full absolute path so the terminal renders it as a clickable link. Format: `Created: /absolute/path/to/file.md`

# Claude files

All claude files should be treated as living files. That means claude and claude agensts should keep them up to date i.e. when we update our tech stack, update the .claude/docs/app-details.md file. Or something that has been added to learnings.md might be important enough to include in the main .claude.md
Remember thse are shared by all developers. You should always prompt the developer when you intend to update a claude file for permissions.

# Forge Workflow

This project uses [forge-workflow](https://github.com/HansonWK/forge-workflow) for structured development. `/workflow` lists every command; the most common are `/begin <task>` to start work, `/next` to execute a subtask, and `/pr` to open a pull request.

- Skills in `.claude/skills/` hold the review/security/testing/architecture rubrics — commands invoke them; you don't call them directly.
- Convention docs: `@.claude/docs/coding.md`, `@.claude/docs/testing.md`, `@.claude/docs/architecture.md`, `@.claude/docs/workflow-config.md`.
- Plans, research, and other ephemeral AI files live in `.claude/temp/` (see the `.MD Files` section above).
- Optional modules configured for this project: **audit** (`/audit`, `/audit-fix`). Not set up: observability, release, secrets — re-run `/install` to add one later.
