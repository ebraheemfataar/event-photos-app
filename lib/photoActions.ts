"use server";

import { getEventPhoto } from "@/lib/data";
import type { Photo } from "@/lib/types";

// Called by the album when a live broadcast says "photo X was added/removed
// in event Y". Broadcast messages on a public channel can be forged by
// anyone, so the album never trusts them: it asks here, and only a real row
// belonging to that event comes back. (Server Functions are public POST
// endpoints — this one only reveals a photo to someone who already has both
// the event id and the photo id.)
export async function fetchEventPhoto(eventId: string, photoId: string): Promise<Photo | null> {
  return getEventPhoto(eventId, photoId);
}
