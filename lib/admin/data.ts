import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";
import type { Photo } from "@/lib/types";
import type { AdminEventRow, AdminListQuery, AdminPlanFilter, AdminStatus } from "@/lib/admin/query";

export type { AdminEventRow } from "@/lib/admin/query";

// Admin-only reads. Callers must have checked the admin session first
// (requireAdmin); these use the service-role key and cover every album.


export async function listAdminEvents(query: AdminListQuery): Promise<{ rows: AdminEventRow[]; total: number }> {
  const { data } = await createServiceClient().rpc("admin_event_list", {
    p_search: query.q.trim() || null,
    p_limit: query.per,
    p_offset: (query.page - 1) * query.per,
    p_status: query.status,
    p_sort: query.sort,
    p_desc: query.desc,
    p_plan: query.plan,
  });
  const rows = (data as AdminEventRow[] | null) ?? [];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function adminStatusCounts(search: string, plan: AdminPlanFilter | null): Promise<Record<AdminStatus, number>> {
  const { data } = await createServiceClient().rpc("admin_event_counts", { p_search: search.trim() || null, p_plan: plan });
  const r = (data as { all_count: number; live: number; closed: number; expired: number }[] | null)?.[0];
  return { all: Number(r?.all_count ?? 0), live: Number(r?.live ?? 0), closed: Number(r?.closed ?? 0), expired: Number(r?.expired ?? 0) };
}

export type AdminStats = {
  albums: number;
  albums_7d: number;
  live: number;
  active_24h: number;
  expiring_7d: number;
  photos: number;
  photos_24h: number;
  contributors: number;
  storage_bytes: number;
  uploads_refused_24h: number;
};

/** Headline numbers for the admin page (admin_stats RPC, 0013). */
export async function adminStats(): Promise<AdminStats> {
  const { data } = await createServiceClient().rpc("admin_stats");
  const r = ((data as Record<string, number | string>[] | null)?.[0] ?? {}) as Record<string, number | string>;
  const n = (k: keyof AdminStats) => Number(r[k] ?? 0);
  return {
    albums: n("albums"),
    albums_7d: n("albums_7d"),
    live: n("live"),
    active_24h: n("active_24h"),
    expiring_7d: n("expiring_7d"),
    photos: n("photos"),
    photos_24h: n("photos_24h"),
    contributors: n("contributors"),
    storage_bytes: n("storage_bytes"),
    uploads_refused_24h: n("uploads_refused_24h"),
  };
}

export type AdminEventDetail = AdminEventRow & { host_token: string; event_type: string | null };

/** One album for its admin page, including the host token (admin only). */
export async function getAdminEvent(eventId: string): Promise<AdminEventDetail | null> {
  if (!isUuid(eventId)) return null;
  const supabase = createServiceClient();
  const [{ data: rows }, { data: token }] = await Promise.all([
    supabase.rpc("admin_event_list", { p_search: eventId, p_limit: 1 }),
    supabase.from("events").select("host_token, event_type").eq("id", eventId).maybeSingle<{ host_token: string; event_type: string | null }>(),
  ]);
  const row = (rows as AdminEventRow[] | null)?.[0];
  return row && token ? { ...row, host_token: token.host_token, event_type: token.event_type } : null;
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

export type AdminPurchase = {
  id: string;
  kind: "plan" | "add_on";
  item: string;
  amount_cents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  provider_ref: string | null;
  email: string | null;
  created_at: string;
  paid_at: string | null;
};

/** Every purchase for one album, newest first (event_purchases, 0015). */
export async function getAdminPurchases(eventId: string): Promise<AdminPurchase[]> {
  if (!isUuid(eventId)) return [];
  const { data } = await createServiceClient()
    .from("event_purchases")
    .select("id, kind, item, amount_cents, status, provider_ref, email, created_at, paid_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .returns<AdminPurchase[]>();
  return data ?? [];
}

export type AuditRow = { id: number; at: string; action: string; event_id: string | null; detail: Record<string, unknown> };

export async function getAudit(eventId?: string, limit = 30): Promise<AuditRow[]> {
  let q = createServiceClient().from("admin_audit").select("id, at, action, event_id, detail").order("at", { ascending: false }).limit(limit);
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q.returns<AuditRow[]>();
  return data ?? [];
}
