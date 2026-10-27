import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Server code only (pages, route handlers,
// server functions) — `server-only` makes importing this from a Client
// Component a build error. Since 0007_lock_down_reads.sql anon can't read
// `events`/`photos` or the private bucket, so every read goes through here,
// always scoped to an id taken from the request. Never select host_token.

let client: SupabaseClient | undefined;

export function createServiceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server env).");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
