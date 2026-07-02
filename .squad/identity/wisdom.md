---
last_updated: 2026-04-01T19:31:22.803Z
---

# Team Wisdom

Reusable patterns and heuristics learned through work. NOT transcripts - each entry is a distilled, actionable insight.

## Patterns

<!-- Append entries below. Format: **Pattern:** description. **Context:** when it applies. -->

## Project Conventions

**Pattern:** Before starting any work, read `.claude/claude.md` at the repo root. **Context:** Every task, every agent, every session. This file is the authoritative source for coding standards (no mutations, pure functions, early returns), TypeScript conventions (strict mode, `type` over `interface`, no `any`), test quality rules (black-box, contract-first), formatting (Prettier — check `.prettierrc`), and the git policy (NEVER run `git add`, `git commit`, `git push`, or `git merge` — all git operations belong to James). These standards take precedence over general best practices when they conflict.
