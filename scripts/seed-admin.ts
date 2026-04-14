/**
 * Seed Admin User Script
 *
 * Generates an INSERT SQL statement for creating an admin user.
 * Pipe the output to `npx wrangler d1 execute` to apply it.
 *
 * Usage:
 *   TENANT_ID=<uuid> ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> npx tsx scripts/seed-admin.ts
 *
 * Then run the printed SQL via:
 *   npx wrangler d1 execute maximum_bookings_db --command "<printed SQL>"
 *
 * For local dev:
 *   npx wrangler d1 execute maximum_bookings_db --local --command "<printed SQL>"
 */

const tenantId = process.env.TENANT_ID;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!tenantId || !email || !password) {
	console.error('Error: TENANT_ID, ADMIN_EMAIL, and ADMIN_PASSWORD environment variables are required.');
	process.exit(1);
}

// PBKDF2 password hashing via Node.js WebCrypto (available in Node 19+)
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

const id = crypto.randomUUID();
const now = new Date().toISOString();
const passwordHash = await hashPassword(password);

const sql = `INSERT INTO AdminUsers (id, tenant_id, email, password_hash, created_date, modified_date) VALUES ('${id}', '${tenantId}', '${email}', '${passwordHash}', '${now}', '${now}');`;

console.log('\n=== Admin User INSERT SQL ===\n');
console.log(sql);
console.log('\n=== Run via Wrangler ===\n');
console.log(`npx wrangler d1 execute maximum_bookings_db --command "${sql}"`);
console.log('\nFor local dev:\n');
console.log(`npx wrangler d1 execute maximum_bookings_db --local --command "${sql}"`);
