/**
 * Seed Admin User Script
 *
 * Known tenant IDs:
 *   6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d  The Red Cow
 *   59986b7d-a829-4315-9b49-f643ec83cf47  The Crown & Anchor
 *   bac4bf8d-f05a-47b8-aab9-f1dc3710fb72  The Oak Tavern
 *
 * Local dev (PowerShell):
 *   $env:TENANT_ID="6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="yourpassword"; $env:LOCAL="true"; npx tsx scripts/seed-admin.ts
 *
 * Production (PowerShell):
 *   $env:TENANT_ID="6a95f5ed-9f85-4675-97c8-3bcd4ce41a4d"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="yourpassword"; npx tsx scripts/seed-admin.ts
 */

import { execSync } from 'child_process';

const tenantId = process.env.TENANT_ID;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const isLocal = process.env.LOCAL === 'true';

if (!tenantId || !email || !password) {
	console.error('Error: TENANT_ID, ADMIN_EMAIL, and ADMIN_PASSWORD environment variables are required.');
	process.exit(1);
}

async function hashPassword(pwd: string): Promise<string> {
	const encoder = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pwd), 'PBKDF2', false, ['deriveBits']);
	const hashBuffer = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100_000 },
		keyMaterial,
		256,
	);
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const hashHex = Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return `${saltHex}:${hashHex}`;
}

async function main() {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const passwordHash = await hashPassword(password!);

	const sql = `INSERT INTO AdminUsers (id, tenant_id, email, password_hash, created_date, modified_date) VALUES ('${id}', '${tenantId}', '${email}', '${passwordHash}', '${now}', '${now}');`;

	const localFlag = isLocal ? '--local ' : '';
	const cmd = `npx wrangler d1 execute maximum_bookings_db ${localFlag}--command "${sql}"`;

	try {
		execSync(cmd, { stdio: 'inherit' });
		console.log(`\n✅ Admin user created: ${email} (tenant: ${tenantId})`);
	} catch {
		console.error(`\n❌ Failed to create admin user.`);
		process.exit(1);
	}
}

main();
