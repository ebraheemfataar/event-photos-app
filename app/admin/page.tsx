import Link from "next/link";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/admin/session";
import { adminStats, adminStatusCounts, listAdminEvents } from "@/lib/admin/data";
import { OVERVIEW_COOKIE, parseAdminQuery } from "@/lib/admin/query";
import { formatBytes } from "@/lib/admin/format";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminAlbumsTable from "@/components/admin/AdminAlbumsTable";
import AdminOverview from "@/components/admin/AdminOverview";

/** Supabase's free plan includes 1 GB of file storage; the bar shows how
 * close the bucket is. Raise this if the project moves to a paid plan. */
const STORAGE_BUDGET_BYTES = 1024 ** 3;

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const query = parseAdminQuery(params);
  const [{ rows, total }, counts, s] = await Promise.all([listAdminEvents(query), adminStatusCounts(query.q, query.plan), adminStats()]);
  const n = (v: number) => v.toLocaleString("en-GB");
  const overviewHidden = (await cookies()).get(OVERVIEW_COOKIE)?.value === "hidden";
  const storagePct = Math.min(100, (s.storage_bytes / STORAGE_BUDGET_BYTES) * 100);

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <AdminOverview initiallyHidden={overviewHidden}>
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Card label="Albums" value={n(s.albums)} note={s.albums_7d ? `+${n(s.albums_7d)} this week` : "None new this week"} good={s.albums_7d > 0} />
          <Card label="Photos" value={n(s.photos)} note={s.photos_24h ? `+${n(s.photos_24h)} in 24 h` : "None in 24 h"} good={s.photos_24h > 0} />
          <Card label="Guests who shared" value={n(s.contributors)} note="Phones that added a photo" />
          <Card label="Storage used" value={formatBytes(s.storage_bytes)} note={`${storagePct < 1 && storagePct > 0 ? "<1" : Math.round(storagePct)}% of ${formatBytes(STORAGE_BUDGET_BYTES)} free plan`}>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <i
                className={`block h-full rounded-full ${storagePct >= 90 ? "bg-danger" : storagePct >= 70 ? "bg-warn-ink" : "bg-accent"}`}
                style={{ width: `${Math.max(storagePct, 1)}%` }}
              />
            </div>
          </Card>
          <Card label="Active today" value={n(s.active_24h)} note="Albums with an upload in 24 h" href="/admin?sort=last_upload" />
          <Card label="Live albums" value={n(s.live)} note="Open for uploads" href="/admin?status=live" />
          <Card label="Expiring in 7 days" value={n(s.expiring_7d)} note="Deleted soon unless upgraded" warn={s.expiring_7d > 0} />
          <Card
            label="Uploads refused (24 h)"
            value={n(s.uploads_refused_24h)}
            note="Rejected files, limits or unfinished uploads"
            warn={s.uploads_refused_24h > 50}
          />
        </section>
        </AdminOverview>

        {params.deleted && (
          <p role="status" className="rounded-[14px] border border-line bg-surface px-4 py-3 text-sm">
            Deleted “{params.deleted}” and all its photos.
          </p>
        )}

        <div>
          <h2 className="mb-3 text-xl font-semibold tracking-[-0.02em]">Albums</h2>
          <AdminAlbumsTable rows={rows} total={total} counts={counts} query={query} />
        </div>
      </main>
    </>
  );
}

function Card({
  label,
  value,
  note,
  href,
  good = false,
  warn = false,
  children,
}: {
  label: string;
  value: string;
  note: string;
  href?: string;
  good?: boolean;
  warn?: boolean;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <dt className="mono text-[10px] text-ink-3">{label}</dt>
      <dd className={`mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums ${warn ? "text-warn-ink" : ""}`}>{value}</dd>
      <dd className={`mt-0.5 text-xs ${good ? "font-semibold text-live" : "text-ink-3"}`}>{note}</dd>
      {children}
    </>
  );
  const box = `flex flex-col rounded-[20px] border bg-surface px-4 py-3.5 ${warn ? "border-warn-line" : "border-line"}`;
  return href ? (
    <Link href={href} className={`${box} transition-colors hover:bg-surface-2`}>
      <dl>{body}</dl>
    </Link>
  ) : (
    <dl className={box}>{body}</dl>
  );
}
