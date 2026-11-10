import { createServiceClient } from "@/lib/supabase/server";
import { getEvent } from "@/lib/data";

// Serves an event's cover or poster from the private bucket. Only the file
// the event currently points at is served, so a replaced or removed image
// stops working (cached copies can live up to an hour, like /photos).

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function GET(_request: Request, ctx: RouteContext<"/media/[eventId]/[kind]/[file]">) {
  const { eventId, kind, file } = await ctx.params;
  if (kind !== "cover" && kind !== "poster") return notFound();

  const event = await getEvent(eventId);
  const path = kind === "cover" ? event?.cover_path : event?.poster_path;
  if (!event || !path || path.startsWith("https://") || path.split("/").pop() !== file) return notFound();

  const { data, error } = await createServiceClient().storage.from("event-photos").download(path);
  if (error || !data) return notFound();

  return new Response(data, {
    headers: {
      "Content-Type": TYPES[file.split(".").pop() ?? ""] ?? "image/jpeg",
      "Content-Length": String(data.size),
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
