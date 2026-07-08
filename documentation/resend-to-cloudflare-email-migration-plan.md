# Migration Plan: Resend → Cloudflare Email Sending

**Status:** Draft / Proposal
**Scope:** Replace Resend with Cloudflare Email Service (Email Sending, Beta) for the three transactional email types the app sends: **confirmation**, **amendment**, and **cancellation** emails to **customers** and **tenants**.
**Date:** 2026-07-07

---

## 1. Current State (what exists today)

### How email works now
- `src/utils/email.ts` — single `sendEmail(env, message)` helper that does a `fetch` POST to `https://api.resend.com/emails` using `RESEND_API_KEY`.
- Templates live in `src/emails/*.ts` (customer/tenant × confirmation/amendment/cancellation) and return `{ subject, html }`. **These do not change.**
- Call sites (all via `sendEmail`):
  - `src/routes/reservations.ts` — public booking create (confirmation), amend, cancel.
  - `src/routes/admin.ts` — admin-created reservation (confirmation), admin amend, admin cancel.
  - Emails are dispatched in pairs (customer + tenant) via `Promise.allSettled` / `c.executionCtx.waitUntil`.
- Types: `src/types/index.ts` → `ResendEnv { RESEND_API_KEY }`, `SendEmailRequest { to, from, reply_to?, subject, html }`.
- Env typing: `src/types/env.d.ts` includes `RESEND_API_KEY`.
- Config docs/secrets: `wrangler.jsonc` comments, `.env.example` (`RESEND_API_KEY`).
- Tests: `test/email-util.spec.ts`, `test/email-integration.spec.ts` (both mock `fetch` to Resend).

### The critical constraint that shapes this migration
Today, the **`from` address is the tenant's own contact email**, e.g.:

```ts
const from = `"${tenant.name} via Maximum Bookings" <${tenant.contact_email}>`;
const replyTo = tenant.contact_email;
```

`tenant.contact_email` is an arbitrary address (Gmail, etc.). **Cloudflare Email Sending only allows sending `from` a domain you have onboarded to Cloudflare Email Service and that uses Cloudflare DNS.** You cannot send `from` a tenant's Gmail address.

**Therefore the core behavioural change is:** send `from` a single verified application domain (e.g. `bookings@mail.maximumbookings.com`), keep the tenant name in the display name, and put the tenant's real address in `Reply-To` so replies still reach the tenant. `Reply-To` is already set everywhere, so replies continue to work — customers replying land in the tenant's inbox.

---

## 2. Cloudflare Configuration (one-time, before code works)

> Requirements: **Workers Paid plan** (Email Sending is Beta, Paid only). The sending domain **must use Cloudflare DNS** (be a zone in the same Cloudflare account).

### 2.1 Choose and onboard a sending domain
1. Dashboard → **Compute → Email Service → Email Sending**.
2. **Onboard Domain** → pick the domain (recommend a dedicated subdomain, e.g. `mail.maximumbookings.com`, to isolate sending reputation from the root domain).
3. Approve the auto-created DNS records (Cloudflare adds them automatically on the `cf-bounce` subdomain):
   - **MX** `cf-bounce.<domain>` → Cloudflare MX servers (bounce handling).
   - **TXT SPF** `cf-bounce.<domain>` → `v=spf1 include:_spf.mx.cloudflare.net ~all`.
   - **TXT DKIM** `cf-bounce._domainkey.<domain>` → Cloudflare-provided public key.
   - **TXT DMARC** `_dmarc.<domain>` → start with `p=none` (monitor), tighten to `quarantine`/`reject` later.
4. Wait for verification (usually 5–15 min for Cloudflare-DNS domains, up to 24h).

### 2.2 Beta recipient constraint (important for testing)
- **Before** a sending domain is fully onboarded/verified, you can only send to **verified destination addresses** in the account (configured under Email Routing). Sends to those are free and don't count toward quota.
- **After** the sending domain is onboarded, you can send to **any** recipient — required for real customers. Confirm the domain shows verified before go-live.

### 2.3 Sending limits
- New accounts get a **conservative daily quota** that scales with good sending reputation. For launch, verify the current quota covers expected daily confirmation/amend/cancel volume; request an increase from the Limits page if needed.
- Content limits (well within our usage): ≤50 recipients/email, subject ≤998 chars, message ≤5 MiB.

### 2.4 No API key needed
Using the **Workers binding** means **no `RESEND_API_KEY`-style secret**. Auth is via the binding, not a token. (A REST-API fallback would need a Cloudflare API token + account ID — see §6, not the recommended path.)

---

## 3. Environment Variables & Secrets

### Removed
| Name | Where | Action |
|------|-------|--------|
| `RESEND_API_KEY` | `.env`, Cloudflare secret, `.env.example`, `src/types/env.d.ts`, `src/types/index.ts` (`ResendEnv`) | Remove. Delete the Cloudflare secret with `npx wrangler secret delete RESEND_API_KEY` after cutover. |

### Added
| Name | Type | Where | Purpose |
|------|------|-------|---------|
| `EMAIL` | Worker **binding** (`send_email`) | `wrangler.jsonc` + generated `worker-configuration.d.ts` | The email-send binding. Not a secret/var. |
| `EMAIL_FROM_ADDRESS` | plain var | `wrangler.jsonc` `vars`, `.env`, `.env.example` | The verified `from` address, e.g. `bookings@mail.maximumbookings.com`. Keeps the domain out of code and configurable per environment. |

> No new secrets are required. `JWT_SECRET`, `SUPER_ADMIN_KEY`, `PUBLIC_URL`, `ENVIRONMENT` are unchanged.

### `wrangler.jsonc` changes
Add the binding and the from-address var; update the secrets comment block (drop the `RESEND_API_KEY` lines).

```jsonc
{
  // ...existing...
  "send_email": [
    {
      "name": "EMAIL",
      // Restrict sender to our verified domain addresses (defence in depth):
      "allowed_sender_addresses": ["bookings@mail.maximumbookings.com"],
      // `remote: true` lets `wrangler dev` send via the real service in local dev.
      "remote": true
    }
  ],
  "vars": {
    "ENVIRONMENT": "production",
    "PUBLIC_URL": "",
    "EMAIL_FROM_ADDRESS": "bookings@mail.maximumbookings.com"
  }
}
```

After editing bindings, run `npx wrangler types` to regenerate `worker-configuration.d.ts` (adds `EMAIL: SendEmail` and `EMAIL_FROM_ADDRESS: string` to `Env`).

### `.env` / `.env.example`
- Remove `RESEND_API_KEY`.
- Add `EMAIL_FROM_ADDRESS=bookings@mail.maximumbookings.com`.
- Note: local `wrangler dev` uses the binding (with `remote: true`) — no API key for local dev. Document that Vitest tests mock the binding, so no live sends occur in CI.

---

## 4. Code Changes

### 4.1 `src/utils/email.ts` — rewrite the helper to use the binding
Replace the Resend `fetch` implementation with a call to `env.EMAIL.send()`. Keep the **same function signature shape** so call sites barely change, but switch the env type to the binding and map `reply_to` → `replyTo` (Cloudflare uses camelCase). Add a `text` fallback and surface the returned `messageId` for logging.

```ts
import type { EmailEnv, SendEmailRequest } from '../types';

export async function sendEmail(env: EmailEnv, message: SendEmailRequest): Promise<void> {
  try {
    await env.EMAIL.send({
      to: message.to,
      from: message.from,
      subject: message.subject,
      html: message.html,
      ...(message.reply_to ? { replyTo: message.reply_to } : {}),
    });
  } catch (error) {
    // Cloudflare throws Error with `.code` and `.message`.
    const e = error as { code?: string; message?: string };
    throw new Error(`Cloudflare Email send failed: ${e.code ?? ''} ${e.message ?? String(error)}`.trim());
  }
}
```

> Note: `from`/`to` accept a plain string like `"Name" <addr@domain>`; the existing display-name format is compatible.

### 4.2 `src/types/index.ts` — replace `ResendEnv`
```ts
// Remove:
// export type ResendEnv = { RESEND_API_KEY: string; }

// Add (binding-based env). `SendEmail` comes from worker-configuration.d.ts.
export type EmailEnv = {
  EMAIL: SendEmail;
  EMAIL_FROM_ADDRESS: string;
};
```
`SendEmailRequest` can stay as-is (`to, from, reply_to?, subject, html`) — the helper maps it to the binding shape. Optionally add `text?: string` later for plain-text parts.

### 4.3 `src/types/env.d.ts` — update augmentation
- Remove `RESEND_API_KEY`.
- Add `EMAIL_FROM_ADDRESS?: string`.
- The `EMAIL` binding will come from regenerated `worker-configuration.d.ts` after `wrangler types`; if hand-augmenting before that, add `EMAIL: SendEmail`.

### 4.4 Call sites — change the `from` address (the key behavioural change)
In **`src/routes/reservations.ts`** (3 places: create/amend/cancel) and **`src/routes/admin.ts`** (3 places), change the `from` so the address is the verified domain while keeping the tenant name and reply-to:

```ts
// BEFORE
const from = `"${tenant.name} via Maximum Bookings" <${tenant.contact_email}>`;
const replyTo = tenant.contact_email;

// AFTER
const from = `"${tenant.name} via Maximum Bookings" <${c.env.EMAIL_FROM_ADDRESS}>`;
const replyTo = tenant.contact_email; // unchanged — replies still go to the tenant
```

Apply the equivalent change wherever `from` is built from `contact_email` (search: `<${...contact_email}>`). The `sendEmail(c.env, {...})` calls themselves don't change (they already pass `c.env`, which now carries the `EMAIL` binding).

Edge case: if a tenant has no `contact_email`, `replyTo` should be omitted (already guarded because `reply_to` is optional). Confirm each call site handles null `contact_email` gracefully.

### 4.5 Optional hardening
- Log `messageId` on success via the observability logs (Workers logging already enabled in `wrangler.jsonc`) for delivery tracing.
- Consider a plain-text `text` body per template for better deliverability/spam scoring (templates currently HTML-only).

---

## 5. Tests

### 5.1 `test/email-util.spec.ts` — rewrite
Replace `fetch`-mock assertions with a mocked `EMAIL` binding:
```ts
const send = vi.fn().mockResolvedValue({ messageId: 'abc' });
const mockEnv = { EMAIL: { send }, EMAIL_FROM_ADDRESS: 'bookings@mail.test' };
// assert send called with { to, from, subject, html, replyTo }
// assert reply_to maps to replyTo
// assert it throws when send() rejects (with .code/.message)
```

### 5.2 `test/email-integration.spec.ts`
Swap the Resend `fetch` mock for an `EMAIL.send` mock on the test env; assert the pair (customer + tenant) is sent, and that `from` uses `EMAIL_FROM_ADDRESS` (not `contact_email`) while `replyTo` uses `contact_email`.

### 5.3 Route tests (`reservations-cancel.test.ts`, `admin.spec.ts`, etc.)
Ensure the test `Env` provides an `EMAIL` binding stub and `EMAIL_FROM_ADDRESS`. Update `test/env.d.ts` if it declares the env shape.

### 5.4 Template tests (`test/email-templates.spec.ts`)
No change — templates are untouched.

---

## 6. Alternative considered: REST API (not recommended)
The REST API (`POST /accounts/{account_id}/email/sending/send`) is the closest 1:1 swap for the existing `fetch` code and would need a **Cloudflare API token** secret + **account ID** var. But since this app *is* a Worker, the **binding is simpler, needs no secret, and is the documented best practice**. Recommend the binding; keep REST as a fallback only if binding limitations surface.

---

## 7. Rollout / Cutover Steps
1. Onboard + verify sending domain in Cloudflare (§2); wait for DNS verification.
2. Add `send_email` binding + `EMAIL_FROM_ADDRESS` var to `wrangler.jsonc`; run `npx wrangler types`.
3. Implement code changes (§4) and update tests (§5); run full test suite.
4. `wrangler dev` with `remote: true` — send a real test confirmation/amend/cancel to a **verified destination address** first, then (post-verification) to an external address.
5. Deploy: `npm run build && npx wrangler deploy`.
6. Smoke test all three flows (confirmation, amendment, cancellation) for both customer and tenant recipients in production.
7. After confirming stable delivery, `npx wrangler secret delete RESEND_API_KEY` and remove Resend from `.env`/`.env.example`. Decommission the Resend account/domain when comfortable.
8. Monitor DMARC reports; tighten `_dmarc` policy from `p=none` → `quarantine`/`reject` once clean.

---

## 8. Risks & Watch-items
- **Sender identity change:** customers now see `from: <bookings@mail.maximumbookings.com>` instead of the tenant's address. Reply-To preserves tenant replies, but the visible sender differs — confirm this is acceptable product-wise. (Cloudflare fundamentally cannot send *from* arbitrary tenant Gmail addresses.)
- **Beta status:** Email Sending is Beta and Paid-plan only. Confirm plan + accept Beta risk.
- **Recipient gating pre-verification:** don't go live until the sending domain is verified, otherwise real customer sends fail.
- **Daily quota:** new-account quota may be low initially; request an increase ahead of launch if volume warrants.
- **Deliverability:** add plain-text parts and keep DMARC monitoring to protect the new sending domain's reputation.

---

## 9. Change Checklist (files)
- [ ] `wrangler.jsonc` — add `send_email` binding + `EMAIL_FROM_ADDRESS` var; update secrets comment.
- [ ] `worker-configuration.d.ts` — regenerate via `npx wrangler types`.
- [ ] `.env` / `.env.example` — remove `RESEND_API_KEY`, add `EMAIL_FROM_ADDRESS`.
- [ ] `src/utils/email.ts` — use `env.EMAIL.send()`.
- [ ] `src/types/index.ts` — replace `ResendEnv` with `EmailEnv`.
- [ ] `src/types/env.d.ts` — drop `RESEND_API_KEY`, add `EMAIL`/`EMAIL_FROM_ADDRESS`.
- [ ] `src/routes/reservations.ts` — `from` uses `EMAIL_FROM_ADDRESS` (×3).
- [ ] `src/routes/admin.ts` — `from` uses `EMAIL_FROM_ADDRESS` (×3).
- [ ] `test/email-util.spec.ts`, `test/email-integration.spec.ts`, route tests, `test/env.d.ts` — mock `EMAIL` binding.
- [ ] Cloudflare dashboard — onboard/verify sending domain; delete `RESEND_API_KEY` secret post-cutover.
