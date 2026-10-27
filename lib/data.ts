import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Event, Photo } from "@/lib/types";

// Server-side reads. Each function takes the id from the URL / caller and
// returns only that record (or that event's photos) — the "knowing the link
// grants access" model, enforced here instead of in the browser.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const PHOTO_COLUMNS = "id, event_id, storage_path, guest_name, content_type, prompt_id, created_at";

export async function getEvent(eventId: string): Promise<Event | null> {
  if (!isUuid(eventId)) return null;
  const { data } = await createServiceClient()
    .from("events")
    .select("id, name, is_active, created_at")
    .eq("id", eventId)
    .maybeSingle<Event>();
  return data;
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

/** One photo, only if it belongs to the given event. */
export async function getEventPhoto(eventId: string, photoId: string): Promise<Photo | null> {
  if (!isUuid(eventId) || !isUuid(photoId)) return null;
  const { data } = await createServiceClient()
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle<Photo>();
  return data;
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
