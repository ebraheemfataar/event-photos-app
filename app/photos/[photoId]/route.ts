import { createServiceClient } from "@/lib/supabase/server";
import { getPhotoFile } from "@/lib/data";

// Serves a photo from the private `event-photos` bucket. The photo id (a
// random uuid, only shown to people who have the album link) is the access
// check; once the photo row is deleted this returns 404.
//
// Cached for an hour so next/image can optimise each photo once per size
// instead of on every page view; a deleted photo can therefore linger in
// caches for up to that long.

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

export async function GET(_request: Request, ctx: RouteContext<"/photos/[photoId]">) {
  const { photoId } = await ctx.params;
  const photo = await getPhotoFile(photoId);
  // Seed / demo rows store a full external URL; those are loaded directly.
  if (!photo || photo.storage_path.startsWith("https://")) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await createServiceClient().storage.from("event-photos").download(photo.storage_path);
  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  // Never echo an unexpected type back (e.g. HTML smuggled in as image/jpeg).
  const type = photo.content_type && ALLOWED_TYPES.has(photo.content_type) ? photo.content_type : "image/jpeg";

  return new Response(data, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.size),
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
