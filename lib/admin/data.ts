import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";
import type { Photo } from "@/lib/types";

// Admin-only reads. Callers must have checked the admin session first
// (requireAdmin); these use the service-role key and cover every album.

export type AdminEventRow = {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  plan: string;
  expires_at: string | null;
  legacy_uncapped: boolean;
  photos: number;
  contributors: number;
  last_upload: string | null;
  storage_bytes: number;
  total_count: number;
};

export const ADMIN_PAGE_SIZE = 50;

export async function listAdminEvents(search: string, page: number): Promise<{ rows: AdminEventRow[]; total: number }> {
  const { data } = await createServiceClient().rpc("admin_event_list", {
    p_search: search.trim() || null,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: Math.max(0, page - 1) * ADMIN_PAGE_SIZE,
  });
  const rows = (data as AdminEventRow[] | null) ?? [];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function adminTotals(): Promise<{ albums: number; live: number; photos: number }> {
  const supabase = createServiceClient();
  const head = { count: "exact" as const, head: true };
  const [albums, live, photos] = await Promise.all([
    supabase.from("events").select("id", head),
    supabase.from("events").select("id", head).eq("is_active", true),
    supabase.from("photos").select("id", head),
  ]);
  return { albums: albums.count ?? 0, live: live.count ?? 0, photos: photos.count ?? 0 };
}

export type AdminEventDetail = AdminEventRow & { host_token: string };

/** One album for its admin page, including the host token (admin only). */
export async function getAdminEvent(eventId: string): Promise<AdminEventDetail | null> {
  if (!isUuid(eventId)) return null;
  const supabase = createServiceClient();
  const [{ data: rows }, { data: token }] = await Promise.all([
    supabase.rpc("admin_event_list", { p_search: eventId, p_limit: 1, p_offset: 0 }),
    supabase.from("events").select("host_token").eq("id", eventId).maybeSingle<{ host_token: string }>(),
  ]);
  const row = (rows as AdminEventRow[] | null)?.[0];
  return row && token ? { ...row, host_token: token.host_token } : null;
}

export async function getAdminPhotos(eventId: string, limit = 300): Promise<Photo[]> {
  if (!isUuid(eventId)) return [];
  const { data } = await createServiceClient()
    .from("photos")
    .select("id, event_id, storage_path, guest_name, content_type, prompt_id, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Photo[]>();
  return data ?? [];
}

export type AuditRow = { id: number; at: string; action: string; event_id: string | null; detail: Record<string, unknown> };

export async function getAudit(eventId?: string, limit = 30): Promise<AuditRow[]> {
  let q = createServiceClient().from("admin_audit").select("id, at, action, event_id, detail").order("at", { ascending: false }).limit(limit);
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q.returns<AuditRow[]>();
  return data ?? [];
}
