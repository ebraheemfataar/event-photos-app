import { createServiceClient } from "@/lib/supabase/server";
import { deleteEventCompletely } from "@/lib/eventCleanup";

// Daily expiry job (Monetisation Stage A, vercel.json → crons). Vercel Cron
// calls this with `Authorization: Bearer $CRON_SECRET`; anything else is 401.
//
// Report-only unless EXPIRY_DELETE_ENABLED=true: it lists the albums past
// their deletion date without touching them. Turn deletion on when pricing
// launches (and reminders exist), not before.
//
// Reminders (7 days and 1 day before, for events with host_email) need an
// email provider, which is still an open decision (docs/PRICING.md).

const BATCH = 25;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const deleting = process.env.EXPIRY_DELETE_ENABLED === "true";
  const { data: due, error } = await createServiceClient()
    .from("events")
    .select("id, expires_at")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at")
    .limit(BATCH);
  if (error) return Response.json({ ok: false, error: "query failed" }, { status: 500 });

  const results: { id: string; deleted: boolean; files: number }[] = [];
  if (deleting) {
    for (const event of due ?? []) {
      const r = await deleteEventCompletely(event.id);
      results.push({ id: event.id, deleted: r.ok, files: r.files });
    }
  }

  return Response.json({
    ok: true,
    mode: deleting ? "delete" : "report-only",
    due: (due ?? []).map((e) => e.id),
    results,
    more: (due?.length ?? 0) === BATCH,
  });
}
