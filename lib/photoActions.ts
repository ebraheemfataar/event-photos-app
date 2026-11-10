"use server";

import { getEventPhotosByIds } from "@/lib/data";
import type { Photo } from "@/lib/types";

// Called by the album when live broadcasts say "photos X, Y were added or
// removed in event Z". Broadcast messages on a public channel can be forged by
// anyone, so the album never trusts them: it asks here, and only real rows
// belonging to that event come back. Ids are batched (Next runs a page's
// Server Function calls one at a time, so one call per upload would queue up
// at a busy event). Server Functions are public POST endpoints — this only
// reveals photos to someone who already has the event id and the photo ids.
export async function fetchEventPhotos(eventId: string, photoIds: string[]): Promise<Photo[]> {
  if (!Array.isArray(photoIds)) return [];
  return getEventPhotosByIds(eventId, photoIds);
}
