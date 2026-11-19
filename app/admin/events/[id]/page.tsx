import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminEvent, getAdminPhotos, getAdminPurchases, getAudit } from "@/lib/admin/data";
import { formatRand } from "@/lib/plans";
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
  const [photos, audit, purchases] = await Promise.all([getAdminPhotos(id), getAudit(id, 15), getAdminPurchases(id)]);

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

            <section aria-label="Payments">
              <h2 className="mb-2.5 text-lg font-semibold">
                Payments {purchases.length > 0 && <span className="text-sm font-normal text-ink-3">({purchases.length})</span>}
              </h2>
              {purchases.length === 0 ? (
                <p className="rounded-[18px] border border-line bg-surface px-4 py-5 text-sm text-ink-3">No purchases yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-[12px] text-ink-3">
                      <tr className="border-b border-line">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Item</th>
                        <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">PayFast ref</th>
                        <th className="px-4 py-2.5 font-medium">Purchase ID · email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p.id} className="border-b border-line last:border-0 align-top">
                          <td className="px-4 py-2.5 text-ink-2">{formatDate(p.paid_at ?? p.created_at, true)}</td>
                          <td className="px-3 py-2.5">
                            {p.item} <span className="text-ink-3">{p.kind === "add_on" ? "extra" : "plan"}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatRand(p.amount_cents)}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.status === "paid"
                                  ? "bg-[#22C55E]/15 text-live"
                                  : p.status === "pending"
                                    ? "bg-surface-3 text-ink-2"
                                    : "bg-danger-bg text-danger"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">{p.provider_ref ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className="block select-all font-mono text-[11px]">{p.id}</span>
                            <span className="block text-xs text-ink-3">{p.email ?? "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

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
