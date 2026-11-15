import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/** The caller's network as a salted hash (never the raw IP), for rate limits
 * and lockouts. Salted with a server secret so stored hashes can't be
 * reversed to IP addresses. */
export async function networkHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local";
  return createHmac("sha256", salt).update(`ip:${ip}`).digest("hex");
}
