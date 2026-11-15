import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ADMIN_PAGE_SIZE, adminTotals, listAdminEvents } from "@/lib/admin/data";
import { formatBytes, formatDate } from "@/lib/admin/format";
import AdminHeader from "@/components/admin/AdminHeader";
import StatusPill from "@/components/admin/StatusPill";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; deleted?: string }> }) {
  await requireAdmin();
  const { q = "", page: pageParam, deleted } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [{ rows, total }, totals] = await Promise.all([listAdminEvents(q, page), adminTotals()]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (p: number) => `/admin?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Albums</h1>
          <dl className="flex gap-2.5">
            <Total label="Albums" value={totals.albums} />
            <Total label="Live" value={totals.live} />
            <Total label="Photos" value={totals.photos} />
          </dl>
        </div>

        {deleted && (
          <p role="status" className="rounded-[14px] border border-line bg-surface px-4 py-3 text-sm">
            Deleted “{deleted}” and all its photos.
          </p>
        )}

        <form className="flex gap-2" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or paste an album id"
            aria-label="Search albums"
            className="h-12 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-[15px] outline-none focus:border-ink"
          />
          <button type="submit" className="h-12 rounded-full bg-btn px-5 text-sm font-semibold text-btn-ink">
            Search
          </button>
        </form>

        <div className="overflow-x-auto rounded-[22px] border border-line bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="mono text-[10px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Album</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 text-right font-medium">Photos</th>
                <th className="px-3 py-3 text-right font-medium">Guests</th>
                <th className="px-3 py-3 text-right font-medium">Storage</th>
                <th className="px-3 py-3 font-medium">Last upload</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                // The name's link stretches over the whole row (after:inset-0), so
                // anywhere on the row opens the album, with normal link behaviour.
                <tr key={e.id} className="relative cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 has-[a:focus-visible]:bg-surface-2">
                  <td className="max-w-[260px] px-4 py-3">
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="block truncate font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:[box-shadow:none]"
                    >
                      {e.name}
                    </Link>
                    <span className="mono block truncate text-[10px] normal-case text-ink-3">{e.id}</span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill active={e.is_active} expiresAt={e.expires_at} />
                  </td>
                  <td className="px-3 py-3 capitalize">{e.legacy_uncapped ? "early" : e.plan}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{e.photos.toLocaleString("en-GB")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{e.contributors.toLocaleString("en-GB")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatBytes(Number(e.storage_bytes))}</td>
                  <td className="px-3 py-3 text-ink-2">{formatDate(e.last_upload)}</td>
                  <td className="px-4 py-3 text-ink-2">{formatDate(e.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ink-3">
                    {q ? `No albums match “${q}”.` : "No albums yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between text-sm">
            <span className="text-ink-3">
              Page {page} of {pages} · {total.toLocaleString("en-GB")} albums
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Link href={href(page - 1)} className="h-10 rounded-full border border-line-strong px-4 leading-10 hover:bg-surface-3">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={href(page + 1)} className="h-10 rounded-full border border-line-strong px-4 leading-10 hover:bg-surface-3">
                  Next
                </Link>
              )}
            </span>
          </nav>
        )}
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
