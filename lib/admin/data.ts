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

export const ADMIN_STATUSES = ["all", "live", "closed", "expired"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];
export const ADMIN_SORTS = ["created", "name", "photos", "guests", "storage", "last_upload"] as const;
export type AdminSort = (typeof ADMIN_SORTS)[number];

export type AdminListQuery = { q: string; page: number; status: AdminStatus; sort: AdminSort; desc: boolean };

/** Reads ?q=&page=&status=&sort=&dir= safely (anything unknown → defaults). */
export function parseAdminQuery(p: Record<string, string | undefined>): AdminListQuery {
  const status = (ADMIN_STATUSES as readonly string[]).includes(p.status ?? "") ? (p.status as AdminStatus) : "all";
  const sort = (ADMIN_SORTS as readonly string[]).includes(p.sort ?? "") ? (p.sort as AdminSort) : "created";
  return { q: (p.q ?? "").slice(0, 100), page: Math.max(1, Number(p.page) || 1), status, sort, desc: p.dir !== "asc" };
}

export async function listAdminEvents(query: AdminListQuery): Promise<{ rows: AdminEventRow[]; total: number }> {
  const { data } = await createServiceClient().rpc("admin_event_list", {
    p_search: query.q.trim() || null,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (query.page - 1) * ADMIN_PAGE_SIZE,
    p_status: query.status,
    p_sort: query.sort,
    p_desc: query.desc,
  });
  const rows = (data as AdminEventRow[] | null) ?? [];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function adminStatusCounts(search: string): Promise<Record<AdminStatus, number>> {
  const { data } = await createServiceClient().rpc("admin_event_counts", { p_search: search.trim() || null });
  const r = (data as { all_count: number; live: number; closed: number; expired: number }[] | null)?.[0];
  return { all: Number(r?.all_count ?? 0), live: Number(r?.live ?? 0), closed: Number(r?.closed ?? 0), expired: Number(r?.expired ?? 0) };
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
    supabase.rpc("admin_event_list", { p_search: eventId, p_limit: 1 }),
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
