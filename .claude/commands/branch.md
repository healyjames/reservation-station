---
description: Create a feature branch from a short description
argument-hint: <type> <description> (e.g., feat add waitlist support)
---

# Create Feature Branch

Create a feature branch off latest main.

## Arguments

$ARGUMENTS — a type (`feat`, `fix`, `chore`, `refactor`, `spike`) and a short description.

If no description is provided, ask the user for one and stop.

## Step 1: Check for Uncommitted Changes

```bash
git status --porcelain
```

**If there are uncommitted changes:**

```
You have uncommitted changes. Please commit, stash, or discard them before creating a new branch.
```

**STOP and wait for user to resolve.**

## Step 2: Ensure We're on Main

```bash
git branch --show-current
```

**If not on main:**

```
Currently on branch '<branch-name>'. I need to switch to main to create the new branch.
Switch to main? (y/n)
```

**STOP and wait for confirmation.** If the user declines, stop entirely.

If confirmed:

```bash
git checkout main
```

## Step 3: Get Latest Main

```bash
git pull origin main
```

If pull fails, inform the user and stop.

## Step 4: Generate Branch Name

1. Take the type from $ARGUMENTS (default to `feat` if not given, or infer from the description).
2. Convert the description to kebab-case: lowercase, replace spaces/special chars with hyphens, remove consecutive hyphens.
3. Combine: `<type>/<kebab-description>` (matching this repo's existing convention, e.g. `feat/lead-delay`).
4. Truncate to 60 characters max (don't cut mid-word).

Present to user:

```
Branch name: <generated-name>
Create this branch? (y, or type a different name)
```

**STOP and wait for confirmation or alternative.**

## Step 5: Create and Checkout Branch

```bash
git checkout -b <branch-name>
```

## Step 6: Confirm

```
Branch '<branch-name>' created from latest main.
You're ready to start work.
```

## Rules

- NEVER create a branch with uncommitted changes
- NEVER switch branches without user confirmation
- Always pull latest main before branching
- Always confirm the branch name with the user before creating
