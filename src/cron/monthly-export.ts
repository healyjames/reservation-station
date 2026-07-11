import { sendEmail } from '../utils/email';

// Monthly D1 export (cron). See BUSINESS_LOGIC.md › "Monthly Database Export (Cron)".
//
// TODO — before this goes live:
//   1. Set REPORT_RECIPIENT and REPORT_SENDER (in .env for local dev, and in the Cloudflare
//      dashboard › Worker › Settings › Variables for prod). REPORT_SENDER MUST be an address
//      on a Resend-verified domain.
//   2. Test locally: `npx wrangler dev --test-scheduled`, trigger the run, and confirm the
//      email + CSV attachments look right (point it at your own address first).
//   3. Deploy: `npm run build && npx wrangler deploy` — the cron registers automatically
//      (up to ~15 min to propagate; then visible under Worker › Settings › Triggers).
//
// TODO — decisions to make:
//   - Sender domain: choose which Resend-verified domain these send FROM. Only
//     redcownantwich.co.uk is verified so far, which is tenant-specific for an all-tenant dump.
//   - Full dump includes AdminUsers: password_hash is redacted, but the CSV still lists admin
//     emails / lockout state. Fine for a private report to yourself — confirm that's acceptable.

// Columns whose values are redacted in the export (secrets/hashes you don't want in your inbox).
const REDACTED_COLUMNS = new Set(['password_hash']);

type Attachment = { filename: string; content: string };

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(csvEscape).join(',');
  const body = rows.map((row) =>
    columns
      .map((col) => (REDACTED_COLUMNS.has(col) ? '[redacted]' : csvEscape(row[col])))
      .join(','),
  );
  return [header, ...body].join('\r\n');
}

async function listTables(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_cf_%'
         AND name NOT LIKE 'd1_%'
       ORDER BY name`,
    )
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

async function tableColumns(db: D1Database, table: string): Promise<string[]> {
  // Identifier is sourced from sqlite_master (not user input), so interpolation is safe.
  const { results } = await db.prepare(`PRAGMA table_info("${table}")`).all<{ name: string }>();
  return results.map((r) => r.name);
}

export async function buildExportAttachments(db: D1Database): Promise<Attachment[]> {
  const tables = await listTables(db);
  const attachments: Attachment[] = [];
  for (const table of tables) {
    const columns = await tableColumns(db, table);
    const { results } = await db.prepare(`SELECT * FROM "${table}"`).all<Record<string, unknown>>();
    const csv = rowsToCsv(columns, results);
    attachments.push({
      filename: `${table}.csv`,
      content: Buffer.from(csv, 'utf8').toString('base64'),
    });
  }
  return attachments;
}

export async function runMonthlyExport(env: Env): Promise<void> {
  const recipient = env.REPORT_RECIPIENT;
  const sender = env.REPORT_SENDER;
  if (!recipient || !sender) {
    console.warn('[monthly-export] REPORT_RECIPIENT / REPORT_SENDER not set — skipping export.');
    return;
  }
  if (!env.RESEND_API_KEY) {
    console.warn('[monthly-export] RESEND_API_KEY not set — skipping export.');
    return;
  }

  const attachments = await buildExportAttachments(env.maximum_bookings_db);
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const tableList = attachments.map((a) => a.filename.replace(/\.csv$/, '')).join(', ');

  await sendEmail(env, {
    to: recipient,
    from: sender,
    subject: `Maximum Bookings — monthly database export (${month})`,
    html: `<p>Attached is the monthly database export generated on ${new Date().toUTCString()}.</p>
           <p>Tables included (${attachments.length}): ${tableList}.</p>
           <p><em>Note: the <code>password_hash</code> column is redacted.</em></p>`,
    attachments,
  });

  console.log(`[monthly-export] Sent ${attachments.length} CSV(s) to ${recipient}.`);
}
