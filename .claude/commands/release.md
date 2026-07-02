---
description: Full release workflow — generate changelog and bump version across all packages
argument-hint: <version e.g. 1.4.0>
---

# Release Workflow

Prepare a full release for version **$ARGUMENTS**.

## Step 1: Resolve Version

If `$ARGUMENTS` is empty or not a valid semver (pattern: `^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$`), ask the user:

```
What version are we releasing? (e.g. 1.4.0)
```

Store the confirmed value as `$VERSION` for all subsequent steps.

## Step 2: Generate Changelog

Follow every step from the `/changelog` command using `$VERSION` as the version argument:

1. Find the previous release commit to determine the commit range
2. Extract all PR merge commits in that range
3. Analyse and categorise each change (Features, Bug Fixes, Refactoring, Infrastructure & DevOps, Documentation)
4. Create `changelog/CHANGELOG-$VERSION.md` using the standard format
5. **STOP** — present the changelog to the user and wait for approval before continuing

Do not proceed to the next step until the user has approved the changelog content.

## Step 3: Bump Version Numbers

Update the `"version"` field to `$VERSION` in each of the following files:

- `package.json`
- `apps/website-dynamic/package.json`
- `apps/website-static/package.json`
- `libs/algolia-adapter/package.json`
- `libs/bluestone-adapter/package.json`
- `libs/coins-adapter/package.json`
- `libs/logger/package.json`
- `libs/storybook/package.json`

For each file, read it, update only the top-level `"version"` field, and write it back. Do not modify any other fields.

## Step 4: Install and Format

Run install to sync the lockfile with the updated root version, then format:

```bash
npm install
npm run format
```

## Step 5: Report

List every file that was updated and confirm:

```
Release $VERSION prepared.

Changelog: changelog/CHANGELOG-$VERSION.md
Version bumped in 8 files:
  ✓ package.json
  ✓ apps/website-dynamic/package.json
  ✓ apps/website-static/package.json
  ✓ libs/algolia-adapter/package.json
  ✓ libs/bluestone-adapter/package.json
  ✓ libs/coins-adapter/package.json
  ✓ libs/logger/package.json
  ✓ libs/storybook/package.json

Next steps:
- Review and commit all changes with message: "RELEASE: v$VERSION"
- Push and create a PR targeting main
```

## Rules

- Never commit or push — the user handles all git operations
- Do not proceed past Step 2 without explicit changelog approval from the user
- Only bump the top-level `"version"` field — do not touch dependency version references
- The package list is the single source of truth from `scripts/ngw-dev-setup.zsh` (`apply-version-ngw`)
