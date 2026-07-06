import { timingSafeEqual, bufToHex } from './auth';

export async function generateManageToken(secret: string, reservationId: string, email: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const message = new TextEncoder().encode(`manage:${reservationId}:${email.toLowerCase()}`);
  const sig = await crypto.subtle.sign('HMAC', key, message);
  return bufToHex(new Uint8Array(sig));
}

export async function hashManageToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bufToHex(new Uint8Array(buf));
}

export async function verifyManageToken(
  secret: string,
  reservationId: string,
  email: string,
  presentedToken: string,
  storedHash: string,
): Promise<boolean> {
  if (!presentedToken || !storedHash) return false;
  // Re-derive the expected token and hash the presented one, then compare hashes
  // using a constant-time function to prevent timing side-channel attacks.
  const expectedToken = await generateManageToken(secret, reservationId, email);
  const expectedHash = await hashManageToken(expectedToken);
  const presentedHash = await hashManageToken(presentedToken);
  return timingSafeEqual(presentedHash, expectedHash) && timingSafeEqual(presentedHash, storedHash);
}
