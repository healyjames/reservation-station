---
description: Turn investigation findings into a /begin prompt
---

# Create Prompt from Investigation

This project has no ticket tracker configured, so this command skips ticket creation and just
produces a ready-to-use `/begin` prompt from whatever was discovered in the conversation so far.

## Instructions

### 1. Gather Context

Review the conversation to identify:

- **Problem discovered**: What issue was found during investigation/testing?
- **Root cause**: Why does the problem occur?
- **Proposed solution**: What approach was discussed?
- **Affected files**: Which files need changes?
- **Scope**: What needs to be done?

If key facts are missing (repro steps, environment, the affected component, expected vs actual), apply the `clarify` skill before writing the prompt rather than guessing.

### 2. Write the Begin Prompt

Create a file at `.claude/temp/<topic>/prompt.md` with:

```markdown
# Prompt: <Short title>

## Problem

<1-2 paragraphs explaining the issue, with concrete examples>

## Solution

<Brief description of the approach>

## Scope

<Numbered list of changes needed, with file locations>

## Implementation Notes

<Any technical details, constraints, or considerations>

## Files to Investigate

<List of files to read during research phase>

## Testing

<How to verify the fix works>
```

### 3. Present to User

Show a summary of the prompt and how to start work later:

- **Summary:** `<summary of prompt content>`
- **File created:** `.claude/temp/<topic>/prompt.md`

To start work later, run:

    /begin @.claude/temp/<topic>/prompt.md

## Rules

- Keep prompts focused - one problem per prompt
- Include concrete examples where possible
- List specific files, not vague references
- Do not start the work - only prepare for future work
