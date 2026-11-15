import { requireAdmin } from "@/lib/admin/session";
import { ADMIN_PAGE_SIZE, adminStatusCounts, adminTotals, listAdminEvents, parseAdminQuery } from "@/lib/admin/data";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminAlbumsTable from "@/components/admin/AdminAlbumsTable";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const query = parseAdminQuery(params);
  const [{ rows, total }, counts, totals] = await Promise.all([listAdminEvents(query), adminStatusCounts(query.q), adminTotals()]);

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">Albums</h1>
            <p className="mt-1 text-sm text-ink-3">Every album on Snap &amp; Share. Click a row to open it.</p>
          </div>
          <dl className="flex gap-2.5">
            <Total label="Albums" value={totals.albums} />
            <Total label="Photos" value={totals.photos} />
          </dl>
        </div>

        {params.deleted && (
          <p role="status" className="rounded-[14px] border border-line bg-surface px-4 py-3 text-sm">
            Deleted “{params.deleted}” and all its photos.
          </p>
        )}

        <AdminAlbumsTable rows={rows} total={total} counts={counts} query={query} pageSize={ADMIN_PAGE_SIZE} />
      </main>
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-[18px] border border-line bg-surface px-4 py-2.5">
      <dd className="text-xl font-semibold tabular-nums">{value.toLocaleString("en-GB")}</dd>
      <dt className="mono text-[10px] text-ink-3">{label}</dt>
    </div>
  );
}
