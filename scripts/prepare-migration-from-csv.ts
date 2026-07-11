/**
 * CSV-driven migration notifier (no production DB reads).
 *
 * Ground-truth inputs:
 *   - export.csv   : the 14 prod rows (id, first_name, surname, email, reservation_date,
 *                    reservation_time, guests, token_status) exported from production.
 *   - Red Cow.csv  : original Dojo export, used only to recover dietary/notes (Comments Consumer)
 *                    matched by email.
 *
 * Tokens are deterministic: token = HMAC-SHA256(JWT_SECRET, "manage:{id}:{email}"),
 * hash = SHA-256(token). Same as src/utils/manageToken.ts.
 *
 * MODES
 *   (default)            Generate db/prod-migration-backfill.sql (14 UPDATEs) and print the
 *                        14 manage URLs. No emails, no DB access.
 *   --parity <id>        Print ONE row's UPDATE statement + live URL to click (parity check).
 *   --send               Send migration emails via Resend to the real customers.
 *   --dry-run            With --send: list who would be emailed; send nothing.
 *
 * FLAGS
 *   --base-url <url>     Link base (default: PUBLIC_URL from .env).
 *   --only <email>       Restrict --send to a single recipient (extra safety).
 *
 * Config from .env: JWT_SECRET, RESEND_API_KEY, PUBLIC_URL.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCustomerMigrationEmail } from '../src/emails/customer-migration';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const TENANT_NAME = 'The Red Cow';
const CONTACT_EMAIL = 'info@redcownantwich.co.uk';

type Target = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  reservationDate: string;
  reservationTime: string;
  guests: number;
  dietary: string | null;
};

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(repoRoot, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// Minimal CSV parser (handles quoted fields with commas).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function loadDietaryByEmail(): Map<string, string> {
  const map = new Map<string, string>();
  const rows = parseCsv(readFileSync(join(repoRoot, 'Red Cow.csv'), 'utf8'));
  const header = rows[0];
  const emailIdx = header.indexOf('Parties Booking Email');
  const commentIdx = header.indexOf('Parties Comments Consumer');
  for (const r of rows.slice(1)) {
    const email = (r[emailIdx] ?? '').trim().toLowerCase();
    const comment = (r[commentIdx] ?? '').trim();
    if (email && comment) map.set(email, comment);
  }
  return map;
}

function loadTargets(): Target[] {
  const dietary = loadDietaryByEmail();
  const rows = parseCsv(readFileSync(join(repoRoot, 'export.csv'), 'utf8'));
  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  return rows.slice(1).map((r) => {
    const email = r[idx('email')].trim();
    return {
      id: r[idx('id')].trim(),
      firstName: r[idx('first_name')].trim(),
      surname: r[idx('surname')].trim(),
      email,
      reservationDate: r[idx('reservation_date')].trim(),
      reservationTime: r[idx('reservation_time')].trim(),
      guests: Number(r[idx('guests')].trim()),
      dietary: dietary.get(email.toLowerCase()) ?? null,
    };
  });
}

function generateManageToken(secret: string, id: string, email: string): string {
  return createHmac('sha256', secret).update(`manage:${id}:${email.toLowerCase()}`).digest('hex');
}
function hashManageToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function build(t: Target, baseUrl: string, secret: string) {
  const token = generateManageToken(secret, t.id, t.email);
  const hash = hashManageToken(token);
  const url = `${baseUrl}/booking/?id=${t.id}&email=${encodeURIComponent(t.email)}&token=${token}`;
  const template = buildCustomerMigrationEmail({
    tenantName: TENANT_NAME,
    firstName: t.firstName,
    reservationDate: t.reservationDate,
    reservationTime: t.reservationTime,
    guests: t.guests,
    dietaryRequirements: t.dietary,
    reservationId: t.id,
    customerEmail: t.email,
    baseUrl,
    manageToken: token,
  });
  return { token, hash, url, template };
}

async function sendViaResend(apiKey: string, msg: { to: string; from: string; reply_to?: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status} ${res.statusText}: ${text}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

  const env = loadEnv();
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing from .env');
  const baseUrl = (val('--base-url') || env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const targets = loadTargets();
  console.log(`Loaded ${targets.length} target(s) | baseUrl: ${baseUrl}`);

  // Parity: one row's UPDATE + live URL.
  if (has('--parity')) {
    const id = val('--parity');
    const t = targets.find((x) => x.id === id) ?? targets[0];
    const { hash, url } = build(t, baseUrl, secret);
    console.log(`\n--- PARITY CHECK for ${t.firstName} ${t.surname} <${t.email}> ---`);
    console.log(`\n1) Run this on PROD:`);
    console.log(`   UPDATE Reservations SET manage_token_hash = '${hash}' WHERE id = '${t.id}';`);
    console.log(`\n2) Then click this LIVE link — it should load the booking:`);
    console.log(`   ${url}`);
    return;
  }

  // Send emails.
  if (has('--send')) {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing from .env');
    const only = val('--only');
    const list = only ? targets.filter((t) => t.email.toLowerCase() === only.toLowerCase()) : targets;
    const dry = has('--dry-run');
    const from = `"${TENANT_NAME} via Maximum Bookings" <${CONTACT_EMAIL}>`;
    console.log(`${dry ? '[DRY-RUN] ' : ''}Sending to ${list.length} recipient(s) from ${from}\n`);
    let sent = 0;
    for (const t of list) {
      const { url, template } = build(t, baseUrl, secret);
      if (dry) { console.log(`  [would send] ${t.email}\n      ${url}`); continue; }
      await sendViaResend(env.RESEND_API_KEY, { to: t.email, from, reply_to: CONTACT_EMAIL, subject: template.subject, html: template.html });
      sent++;
      console.log(`  ✉️  ${t.email}`);
    }
    console.log(dry ? `\n[DRY-RUN] ${list.length} evaluated, nothing sent.` : `\n✅ Sent ${sent} email(s).`);
    return;
  }

  // Default: write the prod backfill SQL + print URLs.
  const lines = [
    '-- Prod migration backfill: sets manage_token_hash so migration email links validate.',
    '-- Generated from export.csv + .env JWT_SECRET. Deterministic & idempotent (safe to re-run).',
  ];
  console.log('\nManage URLs (for reference):');
  for (const t of targets) {
    const { hash, url } = build(t, baseUrl, secret);
    lines.push(`UPDATE Reservations SET manage_token_hash = '${hash}' WHERE id = '${t.id}';`);
    console.log(`  ${t.email}\n    ${url}`);
  }
  const outPath = join(repoRoot, 'db', 'prod-migration-backfill.sql');
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`\n✅ Wrote ${targets.length} UPDATE(s) to: ${outPath}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
