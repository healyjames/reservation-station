---
description: Present changes for user approval
---

# Present Phase

## Prerequisites

Requires:

- Active plan with current subtask Dev and Review complete
- Or changes ready for user review

## Instructions

Present implementation results to user:

```markdown
## Subtask <N>: <title>

### Summary

<2-3 sentences describing what was implemented>

### Goal

<goal from plan.md>

### Files Changed

| File               | Change   | Lines  |
| ------------------ | -------- | ------ |
| `path/to/file.ts`  | created  | +150   |
| `path/to/other.ts` | modified | +23/-5 |

### Tests

- Tests added: <N>
- All passing: Yes/No
- Coverage: <if measurable>

### Review Results

**Code Review:**

- Critical: 0
- High: 0
- Medium: <N>
- Low: <N>

**Security Audit:**

- Critical: 0
- High: 0
- Findings: <summary>

### Outstanding Items

<any Medium/Low issues noted during review>

- <item 1>
- <item 2>

Or: "None - clean review"

### Verification

If live verification was performed during dev (via `live-tester` agent or `/live-test`):

| What     | Detail                                        |
| -------- | --------------------------------------------- |
| Sent     | [entity type] `[id]-local-test` to [service]  |
| Observed | [key log lines]                               |
| Result   | ✓ Working as expected / ✗ Issue found         |
| Check in | [link to Algolia index / Builder.io content]  |
| Cleanup  | Search for `-local-test` and delete when done |

Downstream links by service:

- **Search → Algolia:** `https://dashboard.algolia.com/apps/{APP_ID}/explorer/browse/{index}` (read App ID from service `.env`)
  - Indexes: `persimmon_developments`, `persimmon_plots`, `charles_church_developments`, `charles_church_plots`
- **Content → Builder.io:** `https://builder.io/content` → filter by model (`development`/`plot`/`scheme`) → search for the `-local-test` productId
- **Portal:** local only (Wiremock on 8080), no external cleanup needed

If live verification was NOT performed but would be useful, include:

#### How to Verify Manually

1. Ensure emulators running: `cd azure-emulators && docker compose up`
2. Start [service]: `npx nx serve [service]`
3. [How to trigger — URL to visit, or suggest running `/live-test`]
4. Expected: [what should appear in logs or UI]

---

**Approve?** (y/go, or provide feedback)
```

**STOP and wait for user response.**

## Handle Feedback

If user provides feedback:

1. Implement requested changes
2. Re-run /review if changes are significant
3. Present again with updates

Repeat until user approves.

## After Approval

Update plan.md: check `- [x] Present`
Prompt user to commit changes and run /next to continue

## Rules

- NEVER proceed without explicit user approval
- Show all relevant information for informed decision
- Be honest about outstanding items
- If user has concerns, address them fully
- Update plan.md checkbox only after approval
