import { createServiceClient } from "@/lib/supabase/server";
import { getPhotoFile } from "@/lib/data";

// The small grid copy of a photo (0014). Same access rule as the full photo
// (the random photo id); falls back to 404 when there's no thumbnail, and the
// grid only asks for one when the photo has a thumb_path. Thumbnails are
// re-encoded JPEGs made in the browser, never the original file.

export async function GET(_request: Request, ctx: RouteContext<"/photos/[photoId]/thumb">) {
  const { photoId } = await ctx.params;
  const photo = await getPhotoFile(photoId);
  if (!photo?.thumb_path) return new Response("Not found", { status: 404 });

  const { data, error } = await createServiceClient().storage.from("event-photos").download(photo.thumb_path);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(data.size),
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
