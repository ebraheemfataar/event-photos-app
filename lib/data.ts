import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import type { Event, Photo } from "@/lib/types";
import { planStatus, type AddOn, type Plan, type PlanStatus } from "@/lib/plans";

// Server-side reads. Each function takes the id from the URL / caller and
// returns only that record (or that event's photos) — the "knowing the link
// grants access" model, enforced here instead of in the browser.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const PHOTO_COLUMNS = "id, event_id, storage_path, guest_name, content_type, prompt_id, created_at";

export const EVENT_COLUMNS =
  "id, name, is_active, created_at, theme, event_date, note, cover_path, poster_path, links, plan, expires_at, extra_contributors, legacy_uncapped";

/** All plans, cheapest first. Limits live only in the `plans` table (0011). */
export const getPlans = cache(async (): Promise<Plan[]> => {
  const { data } = await createServiceClient()
    .from("plans")
    .select("id, name, price_cents, max_contributors, retention_days, shows_badge, sort_order")
    .order("sort_order")
    .returns<Plan[]>();
  return data ?? [];
});

/** Plans + add-ons for public pages (landing pricing). Never throws: if the
 * database can't be reached (e.g. a local build without keys) it returns
 * empty lists and the page leaves the pricing section out. */
export async function getPricing(): Promise<{ plans: Plan[]; addOns: AddOn[] }> {
  try {
    const [plans, addOns] = await Promise.all([getPlans(), getAddOns()]);
    return { plans, addOns };
  } catch {
    return { plans: [], addOns: [] };
  }
}

/** Add-ons (extra guests / retention), from the `add_ons` table (0011). */
export const getAddOns = cache(async (): Promise<AddOn[]> => {
  const { data } = await createServiceClient()
    .from("add_ons")
    .select("id, name, price_cents, extra_contributors, extra_retention_days, stackable, sort_order")
    .order("sort_order")
    .returns<AddOn[]>();
  return data ?? [];
});

/** Plan, usage and deletion date for the host's plan sheet. */
export async function getPlanStatus(event: Event): Promise<PlanStatus | null> {
  const plans = await getPlans();
  const plan = plans.find((p) => p.id === event.plan);
  if (!plan) return null;
  const { data } = await createServiceClient().rpc("event_usage", { p_event_id: event.id });
  const usage = (data as { photos: number; contributors: number }[] | null)?.[0] ?? { photos: 0, contributors: 0 };
  return planStatus(event, plan, usage);
}

// cache(): the page, its metadata and its link-preview image all read the
// event in the same request; this makes that one database call.
export const getEvent = cache(async (eventId: string): Promise<Event | null> => {
  if (!isUuid(eventId)) return null;
  const { data } = await createServiceClient()
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .maybeSingle<Event>();
  return data;
});

/** True only if `token` is this event's host token (checked in the DB). */
export async function isEventHost(eventId: string, token: unknown): Promise<boolean> {
  if (!isUuid(eventId) || !isUuid(token)) return false;
  const { data } = await createServiceClient().rpc("is_event_host", {
    p_event_id: eventId,
    p_host_token: token,
  });
  return data === true;
}

export async function getEventPhotos(eventId: string): Promise<Photo[]> {
  if (!isUuid(eventId)) return [];
  const { data } = await createServiceClient()
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .returns<Photo[]>();
  return data ?? [];
}

/** Several photos at once, only those that exist and belong to the event. */
export async function getEventPhotosByIds(eventId: string, photoIds: string[]): Promise<Photo[]> {
  const ids = [...new Set(photoIds)].filter(isUuid).slice(0, 100);
  if (!isUuid(eventId) || ids.length === 0) return [];
  const { data } = await createServiceClient()
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("event_id", eventId)
    .in("id", ids)
    .returns<Photo[]>();
  return data ?? [];
}

/** Storage path + type for serving a photo by id. */
export async function getPhotoFile(
  photoId: string
): Promise<{ storage_path: string; content_type: string | null } | null> {
  if (!isUuid(photoId)) return null;
  const { data } = await createServiceClient()
    .from("photos")
    .select("storage_path, content_type")
    .eq("id", photoId)
    .maybeSingle<{ storage_path: string; content_type: string | null }>();
  return data;
}
