import { createHash, timingSafeEqual } from "node:crypto";

// PayFast signatures (docs/PRICING.md → Stage B). Pure and import-free (no
// Next), so tests can check it. PayFast signs the form / ITN fields as a
// URL-encoded "key=value&…" string, in the order the fields are sent, with
// blank values left out and the passphrase appended, then MD5. Values are
// encoded the way PHP's urlencode does it (spaces as "+", upper-case hex).

export type Pairs = [string, string][];

/** PHP urlencode(): like encodeURIComponent, but also encodes !'()*~ and
 * uses "+" for spaces. */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

/** "k1=v1&k2=v2" from non-blank fields, in order (signature excluded). */
export function paramString(pairs: Pairs): string {
  return pairs
    .filter(([k, v]) => k !== "signature" && v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${phpUrlencode(String(v).trim())}`)
    .join("&");
}

export function sign(pairs: Pairs, passphrase?: string | null): string {
  const base = paramString(pairs);
  const withPass = passphrase && passphrase.trim() ? `${base}&passphrase=${phpUrlencode(passphrase.trim())}` : base;
  return createHash("md5").update(withPass).digest("hex");
}

/** True when the received `signature` matches the other fields (in the
 * order PayFast sent them). Constant-time comparison. */
export function verifySignature(pairs: Pairs, passphrase?: string | null): boolean {
  const received = pairs.find(([k]) => k === "signature")?.[1] ?? "";
  if (!/^[0-9a-f]{32}$/i.test(received)) return false;
  const expected = sign(pairs, passphrase);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

/** The string PayFast signs for an ITN: every field it sent, in order, up to
 * (not including) "signature" — empty values INCLUDED, nothing trimmed. This
 * differs from the checkout form, where blank fields are left out. It's also
 * the body posted back to PayFast's validate endpoint. */
export function itnParamString(pairs: Pairs): string {
  const out: string[] = [];
  for (const [k, v] of pairs) {
    if (k === "signature") break;
    out.push(`${k}=${phpUrlencode(String(v ?? ""))}`);
  }
  return out.join("&");
}

/** True when an ITN's signature matches (PayFast's ITN rules, see above). */
export function verifyItnSignature(pairs: Pairs, passphrase?: string | null): boolean {
  const received = pairs.find(([k]) => k === "signature")?.[1] ?? "";
  if (!/^[0-9a-f]{32}$/i.test(received)) return false;
  const base = itnParamString(pairs);
  const withPass = passphrase && passphrase.trim() ? `${base}&passphrase=${phpUrlencode(passphrase.trim())}` : base;
  const expected = createHash("md5").update(withPass).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

/** PayFast's published ITN source ranges (docs: "valid PayFast IP ranges"),
 * checked in addition to resolving PayFast's hostnames. */
export const PAYFAST_IP_RANGES = ["197.97.145.144/28", "41.74.179.192/27", "102.216.36.0/28", "102.216.36.128/28", "144.126.193.139/32"];

export function ipInRanges(ip: string, ranges: string[] = PAYFAST_IP_RANGES): boolean {
  const toInt = (a: string) => a.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  const value = toInt(ip);
  return ranges.some((r) => {
    const [base, bits] = r.split("/");
    const mask = Number(bits) === 0 ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
    return (value & mask) === (toInt(base) & mask);
  });
}

/** 39900 → "399.00" (PayFast amounts are rands with two decimals). */
export function centsToAmount(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

/** "399.00" → 39900, or null if it isn't a plain amount. */
export function amountToCents(amount: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(String(amount ?? "").trim())) return null;
  return Math.round(Number(amount) * 100);
}
