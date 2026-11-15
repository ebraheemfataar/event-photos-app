import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Pure admin-session token logic (no Next imports, so tests can use it).
// Token = "<expiry seconds>.<HMAC of expiry>", keyed by a hash of
// ADMIN_PASSWORD + the service key: changing the password signs everyone out.

export const SESSION_SECONDS = 12 * 60 * 60;
const MIN_PASSWORD_LENGTH = 12;

function password(): string | null {
  const p = process.env.ADMIN_PASSWORD ?? "";
  return p.length >= MIN_PASSWORD_LENGTH ? p : null;
}

/** False when ADMIN_PASSWORD is missing or too short: the portal stays shut. */
export function adminConfigured(): boolean {
  return password() !== null;
}

function key(): Buffer {
  return createHash("sha256")
    .update(`snap-admin-session|${password()}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`)
    .digest();
}

const sign = (exp: string) => createHmac("sha256", key()).update(exp).digest("hex");

function sameText(a: string, b: string): boolean {
  // Hash both so lengths match and the comparison is constant-time.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(attempt: string): boolean {
  const real = password();
  return real !== null && sameText(attempt, real);
}

export function newSessionToken(now = Date.now()): string {
  const exp = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${exp}.${sign(exp)}`;
}

export function tokenValid(token: string | undefined, now = Date.now()): boolean {
  if (!token || !adminConfigured()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 <= now) return false;
  return sameText(sig, sign(exp));
}
