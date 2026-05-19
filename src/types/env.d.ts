// Augments the auto-generated Env interface (worker-configuration.d.ts) with
// secrets that are not emitted by `wrangler types` until after `wrangler secret put`.
// Run `npx wrangler secret put JWT_SECRET` to register the secret, then
// `npx wrangler types` to regenerate worker-configuration.d.ts and remove this file.
interface Env {
	JWT_SECRET: string;
}
