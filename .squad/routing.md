# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture, system design, technical direction | Han | API design, schema design, D1 migrations plan |
| Code review, PR review, quality gates | Han | Review any PR, enforce patterns, reject/approve |
| Scope decisions, prioritisation | Han | What to build next, trade-offs |
| Hono API routes, request/response handling | Sean | New endpoints, middleware, auth |
| D1 schema, migrations, SQL queries | Sean | Table design, indexes, query optimisation |
| Cloudflare Workers config, wrangler.jsonc, bindings | Sean | KV, D1, R2, service bindings |
| Embeddable widget, HTML/CSS/JS | Twinkie | Widget component, cross-site embed, styling |
| Cloudflare Pages, static assets | Twinkie | Pages config, asset pipeline |
| Widget integration, third-party site embedding | Twinkie | CORS, iframe vs script embed decisions |
| Vitest tests, test suites | Neela | Unit tests, integration tests, test coverage |
| Edge cases, validation, error handling review | Neela | Input validation, boundary conditions |
| QA review, quality gate sign-off | Neela | Approve/reject feature implementations |
| Code review | Han | Review PRs, check quality, suggest improvements |
| Testing | Neela | Write tests, find edge cases, verify fixes |
| Scope & priorities | Han | What to build next, trade-offs, decisions |
| Work queue, backlog, session continuity | Ralph | What to pick up next, what's blocked |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it - analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" - untriaged issues waiting for Lead review.

## Rules

1. **Always delegate code changes.** Any request that involves writing, editing, or deleting source files MUST be routed to the appropriate squad member - never handled directly by the coordinator. If the request is ambiguous, pick the closest domain match and spawn them.
2. **Eager by default** - spawn all agents who could usefully start work, including anticipatory downstream work.
3. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
4. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
5. **When two agents could handle it**, pick the one whose domain is the primary concern.
6. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
7. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.

## Default Code Change Routing

When a request doesn't name a specific agent, use this to pick:

| Request type | Spawn |
|-------------|-------|
| API route, middleware, D1 query, Workers binding | Sean |
| Widget HTML/CSS/JS, Pages config | Twinkie |
| Tests, edge case coverage | Neela |
| Architecture decision, code review, cross-cutting concern | Han |
| Anything touching 2+ domains | Han + relevant members in parallel |
