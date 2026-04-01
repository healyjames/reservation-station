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
| Session logging | Scribe | Automatic — never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.
