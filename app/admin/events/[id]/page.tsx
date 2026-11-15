import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminEvent, getAdminPhotos, getAudit } from "@/lib/admin/data";
import { formatBytes, formatDate } from "@/lib/admin/format";
import AdminHeader from "@/components/admin/AdminHeader";
import StatusPill from "@/components/admin/StatusPill";
import AdminEventActions from "@/components/admin/AdminEventActions";
import AdminPhotoGrid from "@/components/admin/AdminPhotoGrid";

const ACTION_LABELS: Record<string, string> = {
  uploads_closed: "Closed uploads",
  uploads_reopened: "Reopened uploads",
  photo_deleted: "Deleted a photo",
  album_delete_failed: "Album delete failed",
};

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const event = await getAdminEvent(id);
  if (!event) notFound();
  const [photos, audit] = await Promise.all([getAdminPhotos(id), getAudit(id, 15)]);

  const facts: [string, string][] = [
    ["Created", formatDate(event.created_at, true)],
    ["Plan", event.legacy_uncapped ? "Early album · no limit" : event.plan.charAt(0).toUpperCase() + event.plan.slice(1)],
    ["Deletes on", event.expires_at ? formatDate(event.expires_at) : "Never"],
    ["Photos", event.photos.toLocaleString("en-GB")],
    ["Guests who shared", event.contributors.toLocaleString("en-GB")],
    ["Storage", formatBytes(Number(event.storage_bytes))],
    ["Last upload", formatDate(event.last_upload, true)],
  ];

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <Link href="/admin" className="text-sm font-semibold text-ink-2 hover:text-ink">
          ← All albums
        </Link>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">{event.name}</h1>
            <StatusPill active={event.is_active} expiresAt={event.expires_at} />
          </div>
          <span className="mono text-[11px] normal-case text-ink-3">{event.id}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {facts.map(([label, value]) => (
                <div key={label} className="rounded-[18px] border border-line bg-surface px-4 py-3">
                  <dt className="mono text-[10px] text-ink-3">{label}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h2 className="mb-2.5 text-lg font-semibold">
                Photos {photos.length < event.photos && <span className="text-sm font-normal text-ink-3">(newest {photos.length})</span>}
              </h2>
              <AdminPhotoGrid eventId={event.id} photos={photos} />
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <AdminEventActions
              eventId={event.id}
              name={event.name}
              active={event.is_active}
              hostPath={`/host/${event.id}?t=${event.host_token}`}
              guestPath={`/e/${event.id}`}
            />
            <section className="rounded-[22px] border border-line bg-surface p-4">
              <h2 className="text-base font-semibold">Admin activity</h2>
              {audit.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">Nothing yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {audit.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3">
                      <span>{ACTION_LABELS[a.action] ?? a.action}</span>
                      <span className="shrink-0 text-ink-3">{formatDate(a.at, true)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
