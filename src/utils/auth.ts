function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
	return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
		'deriveBits',
	]);
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

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(':');
	if (!saltHex || !hashHex) return false;

	const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
	const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
		'deriveBits',
	]);
	const hashBuffer = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100_000 },
		keyMaterial,
		256,
	);
	const derivedHex = Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	// Constant-time compare
	if (derivedHex.length !== hashHex.length) return false;
	let diff = 0;
	for (let i = 0; i < derivedHex.length; i++) {
		diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
	}
	return diff === 0;
}

export async function signJWT(payload: { userId: string; tenantId: string }, secret: string, expiresInSeconds = 8 * 60 * 60): Promise<string> {
	const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const now = Math.floor(Date.now() / 1000);
	const body = toBase64Url(
		new TextEncoder().encode(
			JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }),
		),
	);
	const signingInput = `${header}.${body}`;
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
	const signature = toBase64Url(new Uint8Array(sigBuffer));
	return `${signingInput}.${signature}`;
}

export async function verifyJWT(
	token: string,
	secret: string,
): Promise<{ userId: string; tenantId: string } | null> {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [header, body, signature] = parts;
	const signingInput = `${header}.${body}`;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify'],
	);
	const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), new TextEncoder().encode(signingInput));
	if (!valid) return null;

	let claims: Record<string, unknown>;
	try {
		claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
	} catch {
		return null;
	}

	const now = Math.floor(Date.now() / 1000);
	if (typeof claims.exp !== 'number' || claims.exp < now) return null;
	if (typeof claims.userId !== 'string' || typeof claims.tenantId !== 'string') return null;

	return { userId: claims.userId, tenantId: claims.tenantId };
}
