import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";

const BUCKET = "event-photos";

/** Deletes an album for good: every file in its storage folder (photos,
 * cover, poster), then the event row, which cascades to photos and upload
 * tickets (each photo delete is broadcast, so open albums empty out).
 * Used by the expiry job; the admin portal will reuse it. */
export async function deleteEventCompletely(eventId: string): Promise<{ ok: boolean; files: number }> {
  if (!isUuid(eventId)) return { ok: false, files: 0 };
  const storage = createServiceClient().storage.from(BUCKET);
  let files = 0;

  for (const folder of [`${eventId}/_event`, eventId]) {
    // list() pages at 100 by default; keep going until the folder is empty.
    for (;;) {
      const { data, error } = await storage.list(folder, { limit: 1000 });
      if (error) return { ok: false, files };
      const paths = (data ?? []).filter((o) => o.id !== null).map((o) => `${folder}/${o.name}`);
      if (paths.length === 0) break;
      const { error: removeError } = await storage.remove(paths);
      if (removeError) return { ok: false, files };
      files += paths.length;
    }
  }

  const { error } = await createServiceClient().from("events").delete().eq("id", eventId);
  return { ok: !error, files };
}
