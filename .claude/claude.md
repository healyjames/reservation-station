# Development Guidelines for Claude

> **About this file:** This is a modular version with detailed documentation loaded on-demand. The main file (this one) provides core principles and quick reference. Detailed guidelines are in separate files imported via `@~/.claude/docs/...`.

# Git Operations Policy

⛔ **NEVER commit or push to git without explicit user request**

- DO NOT run `git commit`, `git push`, or `git add` unless explicitly asked
- Code changes and file modifications are fine
- User will handle all git operations (commits, pushes, etc.)
- Exception: Branch operations like checkout may be acceptable when instructed

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

Code should be self-documenting. Please avoid leaving comments in code unless they are needed to understand the code. Examples of appriate comments are explaining regex that isn't instantly understandable, or explaining imports from a third party like the fonts loaded through an adobe stylesheet.

- No data mutation - immutable data structures only where possible
- Pure functions wherever possible
- No nested if/else - use early returns or composition
- No comments - code should be self-documenting
- Prefer options objects over positional parameters
- Use array methods (`map`, `filter`, `reduce`) over loops

# Formatting

The repo uses Prettier for code formatting. Before submitting changes, always check ./.prettierrc

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

# Typescript

Follow best practices wherever possible. Avoid using `any` at all costs. When using `unknown`, it must have a comment exaplianing why if it is not obvious.
Strict mode always. Schema-first at trust boundaries, types for internal logic.

**Prefer `type` over `interface`**: Use `type` aliases for all type definitions. Only use `interface` when you specifically need declaration merging or class implementation contracts.

**Unused parameters:** When a function parameter is required by an interface but not used in the implementation, prefix it with an underscore (e.g., `_context` instead of `context`). This silences IDE warnings about unused variables while maintaining the function signature.

# Repo DRY Principles

When the same constant, list, or logic appears in multiple services, extract it to `src/utils/`, `src/schema` or `src/types`. This is especially important for:

- Filter/exclusion lists used across services (e.g. media type exclusions)
- Enum values or string unions shared between producer and consumer services
- Mapping logic that is identical across services

When extracting shared constants, always verify the extracted version matches **all** existing inline usages — missing a value is a behavioral regression.

# Test Quality

## Black-box testing — test the contract, not the implementation

Tests should verify **what** a function produces for a given input, not **how** it produces it internally. Treat the function under test as a black box: given input X, expect output Y. Do not test internal side effects like logging calls, intermediate variable states, or the order of internal operations — these are implementation details that make tests brittle and couple them to code structure rather than behavior.

**Test this (boundary/contract):**

- Given valid input → returns expected output
- Given invalid input → returns error / empty result / throws
- Given edge case input (empty array, null, boundary values) → handles gracefully

**Do NOT test this (implementation detail):**

- Whether a logger was called mid-function
- Internal method call order
- Private helper function behavior (test through the public API)

Business logic must always have full test coverage. If a function transforms data, assert on the transformation result. If it filters, assert on what's included and excluded. The tests should survive a refactor of the internals without changing.

## Formatting

- **Test names must match assertions**: If a test name says "and log an error", the test must assert that the logger was called. Misleading test names are bugs.
- **Blank line separation**: Maintain consistent blank lines between `it()` blocks within a `describe()`.
- **New functions need tests**: Every new exported function or significant code path must have test coverage before the task is considered complete.


# Shared Zod Schemas

The repo uses shared Zod schemas in `src\schema` for validation.

⚠️ **CRITICAL: Schema-Code Consistency Rule**

When any code change introduces, removes, or renames a value that is validated by a Zod schema (e.g. adding a new media type, entity type, status, or enum value), the corresponding Zod schema in `src\schema` **MUST** be updated in the same change. Failing to do so causes runtime validation errors in downstream services.

**Checklist for any change involving typed/enumerated values:**

1. Search `src\schema` for the relevant Zod enum or schema
2. Add/remove/rename the value in the schema
3. Check all services that import that schema still compile
4. Verify tests pass with the updated schema

This applies to all reviews, PRs, and dev work — not just schema-specific tasks.

# Testing

For comprehensive testing guidelines including:

- Tests must document expected business behavior
- Behavior-driven testing principles and anti-patterns
- Test data patterns and factory functions with full examples
- Achieving 100% coverage for core business behavior, not implementation details
- React component testing strategies
- Testing tools (Jest, Vitest, React Testing Library)
- Validating test data with schemas
- Prefer factory functions for test data.
- Store mocks in a /mock folder for use through multiple components

## Predict-then-verify workflow (catching side effects)

When modifying existing code that has tests:

1. **Read the existing test file** before making changes
2. **Predict which tests will break** based on the code changes you're making — write down your predictions
3. **Run the tests** and compare actual failures against your predictions
4. **Investigate mismatches**:
   - A test you predicted would break but didn't → your understanding of the code may be wrong, or the test isn't covering what you think
   - A test you didn't predict would break but did → you've introduced a side effect. This is likely a bug — investigate before updating the test
5. **Update tests** to match the new logic only after confirming the new behavior is correct

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
