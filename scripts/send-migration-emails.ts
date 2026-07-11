/**
 * Booking migration notifier.
 *
 * For customers whose bookings were imported from a previous system (e.g. Dojo),
 * this script:
 *   1. Generates each reservation's manage token  = HMAC-SHA256(JWT_SECRET, "manage:{id}:{email}")
 *   2. Backfills Reservations.manage_token_hash    = SHA-256(token)   (so the new manage link validates)
 *   3. Sends a migration notice email containing a working "Manage my booking" link.
 *
 * Tokens are deterministic: the same (secret, id, email) always yields the same token,
 * so re-running is safe and idempotent.
 *
 * MODES
 *   --preview [--id <reservationId>]
 *       Render the email HTML for one booking to a file and print the URL. No DB writes, no send.
 *
 *   --test <recipientEmail> [--id <reservationId>]
 *       Send ONE real email (via Resend) to <recipientEmail> using a real booking's token.
 *       Also backfills that one booking's hash so the link works. Everything else untouched.
 *
 *   --backfill
 *       Write manage_token_hash for ALL target rows. No emails sent.
 *
 *   --send
 *       Backfill hashes AND send migration emails to every target customer's real address.
 *
 * FLAGS
 *   --local | --remote     Which D1 to read/write (default: --local)
 *   --ids-file <path>      JSON allowlist of reservation IDs to target (recommended for prod)
 *   --tenant <id>          Tenant to target (used if --ids-file omitted)
 *   --id <reservationId>   Restrict preview/test to a single booking
 *   --base-url <url>       Override the link base URL (else PUBLIC_URL from .env)
 *   --dry-run              For test/verify/backfill/send: report only, no DB writes, no emails
 *
 *   --verify <id>          Backfill ONE row and print its live manage link to click (no email).
 *                          Use to confirm production JWT_SECRET parity before a real send.
 *
 * Idempotency: --send records each emailed reservation in a local ledger
 * (scripts/.migration-sent-<location>-<tenant>.json) and skips ids already sent,
 * so a re-run after a crash never double-emails. Hash backfill is deterministic/idempotent.
 *
 * Secrets/config are read from .env: JWT_SECRET, RESEND_API_KEY, PUBLIC_URL.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCustomerMigrationEmail } from '../src/emails/customer-migration';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const DB_NAME = 'maximum_bookings_db';

type Row = {
  id: string;
  tenant_id: string;
  first_name: string;
  email: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  dietary_requirements: string | null;
  tenant_name: string;
  contact_email: string;
};

// ---- env ------------------------------------------------------------------
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = '';
  try {
    raw = readFileSync(join(repoRoot, '.env'), 'utf8');
  } catch {
    throw new Error('.env not found at repo root — cannot read JWT_SECRET / RESEND_API_KEY.');
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// ---- token (must match src/utils/manageToken.ts + bufToHex) ---------------
function generateManageToken(secret: string, id: string, email: string): string {
  return createHmac('sha256', secret).update(`manage:${id}:${email.toLowerCase()}`).digest('hex');
}
function hashManageToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---- D1 access via wrangler ----------------------------------------------
// Invoke the local wrangler JS bin directly with `node` (shell: false) and pass the
// SQL as a single `--command` argument. This matters for two reasons:
//   1. shell:false + args array => the SQL is one argv token, so multi-word statements
//      are never word-split by the shell (the reason the old code resorted to --file).
//   2. On --remote, wrangler's `--file` path UPLOADS the file and returns a stats
//      *summary* (e.g. {"Rows read": 1}) instead of the query rows — that single summary
//      object was the phantom "1 row" bug. `--command` returns the actual result set.
const WRANGLER_BIN = join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
function d1(sql: string, location: 'local' | 'remote'): any[] {
  const args = [WRANGLER_BIN, 'd1', 'execute', DB_NAME, `--${location}`, '--json', '--command', sql];
  const stdout = execFileSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // wrangler may print banner/progress lines before the JSON; extract the JSON array.
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start < 0 || end < start) return [];
  const parsed = JSON.parse(stdout.slice(start, end + 1));
  return parsed[0]?.results ?? [];
}

function fetchRows(location: 'local' | 'remote', opts: { ids?: string[]; tenantId?: string; id?: string; requireNullHash?: boolean }): Row[] {
  const where: string[] = [];
  if (opts.requireNullHash) where.push('r.manage_token_hash IS NULL');
  if (opts.tenantId) where.push(`r.tenant_id = '${opts.tenantId}'`);
  if (opts.id) where.push(`r.id = '${opts.id}'`);
  if (opts.ids && opts.ids.length) {
    where.push(`r.id IN (${opts.ids.map((i) => `'${i}'`).join(', ')})`);
  }
  if (!where.length) throw new Error('fetchRows: refusing to run with no filter.');
  const sql = `SELECT r.id, r.tenant_id, r.first_name, r.email, r.reservation_date, r.reservation_time,
      r.guests, r.dietary_requirements, t.name AS tenant_name, t.contact_email
    FROM Reservations r JOIN Tenants t ON t.id = r.tenant_id
    WHERE ${where.join(' AND ')} ORDER BY r.reservation_date, r.reservation_time;`;
  return d1(sql, location) as Row[];
}

// ---- sent ledger (idempotency, decoupled from the hash backfill) ----------
type Ledger = { sent: Record<string, string> }; // reservationId -> ISO timestamp
function ledgerPath(location: string, tenantId: string): string {
  return join(__dirname, `.migration-sent-${location}-${tenantId}.json`);
}
function readLedger(p: string): Ledger {
  if (!existsSync(p)) return { sent: {} };
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Ledger;
  } catch {
    return { sent: {} };
  }
}
function recordSent(p: string, ledger: Ledger, id: string): void {
  ledger.sent[id] = new Date().toISOString();
  writeFileSync(p, JSON.stringify(ledger, null, 2), 'utf8');
}

function loadTargetIds(idsFile?: string): { tenantId?: string; ids: string[] } {
  if (!idsFile) return { ids: [] };
  const parsed = JSON.parse(readFileSync(idsFile, 'utf8'));
  return { tenantId: parsed.tenant_id, ids: parsed.reservation_ids ?? [] };
}

// ---- email ----------------------------------------------------------------
async function sendViaResend(apiKey: string, msg: { to: string; from: string; reply_to?: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status} ${res.statusText}: ${text}`);
  return text;
}

function buildEmailFor(row: Row, baseUrl: string, secret: string) {
  const token = generateManageToken(secret, row.id, row.email);
  const hash = hashManageToken(token);
  const template = buildCustomerMigrationEmail({
    tenantName: row.tenant_name,
    firstName: row.first_name,
    reservationDate: row.reservation_date,
    reservationTime: row.reservation_time,
    guests: row.guests,
    dietaryRequirements: row.dietary_requirements,
    reservationId: row.id,
    customerEmail: row.email,
    baseUrl,
    manageToken: token,
  });
  const url = `${baseUrl}/booking/?id=${row.id}&email=${encodeURIComponent(row.email)}&token=${token}`;
  return { token, hash, template, url };
}

// ---- main -----------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const location: 'local' | 'remote' = has('--remote') ? 'remote' : 'local';
  const tenantIdFlag = val('--tenant');
  const onlyId = val('--id');
  const idsFile = val('--ids-file');
  const dryRun = has('--dry-run');
  const env = loadEnv();
  const secret = env.JWT_SECRET;
  const baseUrl = (val('--base-url') || env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  if (!secret) throw new Error('JWT_SECRET missing from .env');

  const target = loadTargetIds(idsFile);
  const tenantId = tenantIdFlag || target.tenantId;

  const mode = has('--send')
    ? 'send'
    : has('--backfill')
      ? 'backfill'
      : has('--verify')
        ? 'verify'
        : has('--test')
          ? 'test'
          : 'preview';
  console.log(`Mode: ${mode} | DB: ${location} | baseUrl: ${baseUrl}${dryRun ? ' | DRY-RUN' : ''}`);

  if (mode === 'preview') {
    const rows = fetchRows(location, { ids: target.ids, tenantId, id: onlyId, requireNullHash: !idsFile && !onlyId });
    if (!rows.length) throw new Error('No rows found.');
    const row = rows[0];
    const { template, url } = buildEmailFor(row, baseUrl, secret);
    const outPath = join(repoRoot, 'migration-email-preview.html');
    writeFileSync(outPath, template.html, 'utf8');
    console.log(`\nPreview booking: ${row.first_name} <${row.email}> (${row.id})`);
    console.log(`Subject: ${template.subject}`);
    console.log(`Manage URL:\n  ${url}`);
    console.log(`\nHTML written to: ${outPath}`);
    return;
  }

  if (mode === 'verify') {
    // Backfill exactly ONE row and print its live link to click. No email sent.
    const id = val('--verify');
    if (!id) throw new Error('Usage: --verify <reservationId> --base-url <liveUrl> --remote');
    const rows = fetchRows(location, { id });
    if (!rows.length) throw new Error(`Reservation ${id} not found.`);
    const row = rows[0];
    const { hash, url } = buildEmailFor(row, baseUrl, secret);
    if (dryRun) {
      console.log(`\n[dry-run] Would backfill ${row.id} and produce link:\n  ${url}`);
      return;
    }
    d1(`UPDATE Reservations SET manage_token_hash = '${hash}' WHERE id = '${row.id}';`, location);
    console.log(`\nBackfilled ${row.first_name}'s booking (${row.id}). Click this LIVE link to confirm it validates:\n  ${url}`);
    console.log('\nNo email was sent. If the page loads the booking, JWT_SECRET parity is confirmed.');
    return;
  }

  if (mode === 'test') {
    const recipient = val('--test');
    if (!recipient) throw new Error('Usage: --test <recipientEmail>');
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing from .env');
    const rows = fetchRows(location, { ids: target.ids, tenantId, id: onlyId, requireNullHash: !idsFile && !onlyId });
    if (!rows.length) throw new Error('No rows found to build a test from.');
    const row = rows[0];
    const { hash, template, url } = buildEmailFor(row, baseUrl, secret);
    const from = `"${row.tenant_name} via Maximum Bookings" <${row.contact_email}>`;
    if (dryRun) {
      console.log(`\n[dry-run] Would send TEST to ${recipient} (from: ${from})\n  ${url}`);
      return;
    }
    d1(`UPDATE Reservations SET manage_token_hash = '${hash}' WHERE id = '${row.id}';`, location);
    console.log(`\nSending TEST to ${recipient} (booking of ${row.first_name}, from: ${from})`);
    console.log(`Manage URL:\n  ${url}`);
    await sendViaResend(env.RESEND_API_KEY, { to: recipient, from, reply_to: row.contact_email, subject: template.subject, html: template.html });
    console.log('✅ Test email sent.');
    return;
  }

  // ---- backfill / send (bulk over the explicit target set) ----------------
  if (!idsFile && !tenantId) throw new Error('--backfill/--send require --ids-file <file> (recommended) or --tenant <id>.');
  const rows = fetchRows(location, { ids: target.ids, tenantId, requireNullHash: !idsFile });
  if (!tenantId) throw new Error('Could not resolve tenant id for ledger.');

  const lpath = ledgerPath(location, tenantId);
  const ledger = readLedger(lpath);
  const already = rows.filter((r) => ledger.sent[r.id]).length;
  console.log(`Targeting ${rows.length} reservation(s). Already emailed (ledger): ${already}. Ledger: ${lpath}`);

  if (dryRun) {
    for (const row of rows) {
      const { url } = buildEmailFor(row, baseUrl, secret);
      const status = ledger.sent[row.id] ? 'SKIP (already sent)' : mode === 'send' ? 'WOULD EMAIL' : 'WOULD BACKFILL';
      console.log(`  [${status}] ${row.first_name} <${row.email}>\n      ${url}`);
    }
    console.log(`\n[dry-run] No DB writes, no emails. ${rows.length} row(s) evaluated.`);
    return;
  }

  let sent = 0;
  let backfilled = 0;
  for (const row of rows) {
    const { hash, template, url } = buildEmailFor(row, baseUrl, secret);
    // Backfill is idempotent (deterministic hash) — safe to repeat.
    d1(`UPDATE Reservations SET manage_token_hash = '${hash}' WHERE id = '${row.id}';`, location);
    backfilled++;
    if (mode === 'send') {
      if (ledger.sent[row.id]) {
        console.log(`  ⏭️  ${row.email} (already emailed ${ledger.sent[row.id]})`);
        continue;
      }
      if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing from .env');
      const from = `"${row.tenant_name} via Maximum Bookings" <${row.contact_email}>`;
      await sendViaResend(env.RESEND_API_KEY, { to: row.email, from, reply_to: row.contact_email, subject: template.subject, html: template.html });
      recordSent(lpath, ledger, row.id);
      sent++;
      console.log(`  ✉️  ${row.email}  ${url}`);
    } else {
      console.log(`  🔑 backfilled ${row.id}`);
    }
  }
  console.log(mode === 'send' ? `\n✅ Backfilled ${backfilled}, sent ${sent} email(s). Ledger updated.` : `\n✅ Backfilled ${backfilled} hash(es). No emails sent.`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
