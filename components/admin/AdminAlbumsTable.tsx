"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ADMIN_PAGE_SIZES,
  ADMIN_PLAN_FILTERS,
  DEFAULT_ADMIN_QUERY,
  type AdminEventRow,
  type AdminListQuery,
  type AdminPlanFilter,
  type AdminSort,
  type AdminStatus,
} from "@/lib/admin/query";
import { adminBulkDelete, adminBulkSetUploads, adminDeleteEvent, adminSetUploads } from "@/lib/admin/actions";
import { formatBytes, formatDate, timeAgo } from "@/lib/admin/format";
import StatusPill from "@/components/admin/StatusPill";
import Spinner from "@/components/Spinner";

// Admin albums table, after the "Invoices" inspiration: status tabs with
// counts, search (⌘K / Ctrl+K), Sort and Filter menus, active-filter chips,
// rows-per-page, sortable sticky headers, row checkboxes with a bulk bar, a ⋮
// menu per row, numbered pages. Everything lives in the URL, and the
// database does the filtering and sorting.

const TABS: { id: AdminStatus; label: string }[] = [
  { id: "all", label: "All albums" },
  { id: "live", label: "Live" },
  { id: "closed", label: "Closed" },
  { id: "expired", label: "Expired" },
];

const SORT_LABELS: Record<AdminSort, string> = {
  created: "Created",
  name: "Name",
  photos: "Photos",
  guests: "Guests",
  storage: "Storage",
  last_upload: "Last upload",
};

const PLAN_LABELS: Record<AdminPlanFilter, string> = {
  free: "Free",
  small: "Small",
  medium: "Medium",
  unlimited: "Unlimited",
  early: "Early (before plans)",
};

export default function AdminAlbumsTable({
  rows,
  total,
  counts,
  query,
}: {
  rows: AdminEventRow[];
  total: number;
  counts: Record<AdminStatus, number>;
  query: AdminListQuery;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [navigating, startNav] = useTransition();

  // A new page / filter starts with nothing selected.
  const pageKey = rows.map((r) => r.id).join(",");
  const [seenKey, setSeenKey] = useState(pageKey);
  if (seenKey !== pageKey) {
    setSeenKey(pageKey);
    setSelected(new Set());
  }

  // ⌘K / Ctrl+K (and "/") jump to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const href = (patch: Partial<AdminListQuery>) => {
    const next = { ...query, ...patch };
    const d = DEFAULT_ADMIN_QUERY;
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.status !== d.status) p.set("status", next.status);
    if (next.plan) p.set("plan", next.plan);
    if (next.sort !== d.sort) p.set("sort", next.sort);
    if (!next.desc) p.set("dir", "asc");
    if (next.per !== d.per) p.set("per", String(next.per));
    if (next.page > 1) p.set("page", String(next.page));
    const s = p.toString();
    return s ? `/admin?${s}` : "/admin";
  };
  const go = (patch: Partial<AdminListQuery>) => startNav(() => router.push(href(patch)));

  const pages = Math.max(1, Math.ceil(total / query.per));
  const from = total === 0 ? 0 : (query.page - 1) * query.per + 1;
  const to = Math.min(total, query.page * query.per);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = rows.some((r) => selected.has(r.id));
  const ids = [...selected];
  const filtered = Boolean(query.q || query.plan || query.status !== "all");

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await task();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setSelected(new Set());
      setConfirm(null);
      setTyped("");
      setMenu(null);
      router.refresh();
    });
  }

  // For one album, confirm by typing its name; for several, "delete N".
  const confirmWord = confirm ? (confirm.ids.length === 1 ? confirm.label : `delete ${confirm.ids.length}`) : "";

  return (
    <section className="flex flex-col gap-3">
      {/* Status tabs + Sort / Filter */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
        <nav aria-label="Filter by status" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {TABS.map((t) => {
            const on = query.status === t.id;
            return (
              <Link
                key={t.id}
                href={href({ status: t.id, page: 1 })}
                aria-current={on ? "page" : undefined}
                className={`-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
                  on ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${on ? "bg-btn text-btn-ink" : "bg-surface-3 text-ink-2"}`}>
                  {counts[t.id].toLocaleString("en-GB")}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mb-2 flex gap-2">
          <Dropdown
            label="Sort"
            icon={<SortIcon />}
            active={query.sort !== "created" || !query.desc}
            items={[
              ...(Object.keys(SORT_LABELS) as AdminSort[]).map((s) => ({
                key: s,
                label: SORT_LABELS[s],
                checked: query.sort === s,
                onSelect: () => go({ sort: s, desc: s === "name" ? false : query.sort === s ? query.desc : true, page: 1 }),
              })),
              "divider" as const,
              { key: "desc", label: query.sort === "name" ? "Z → A" : "Highest / newest first", checked: query.desc, onSelect: () => go({ desc: true, page: 1 }) },
              { key: "asc", label: query.sort === "name" ? "A → Z" : "Lowest / oldest first", checked: !query.desc, onSelect: () => go({ desc: false, page: 1 }) },
            ]}
          />
          <Dropdown
            label="Filter"
            icon={<FilterIcon />}
            active={Boolean(query.plan)}
            items={[
              { key: "any", label: "Any plan", checked: !query.plan, onSelect: () => go({ plan: null, page: 1 }) },
              ...ADMIN_PLAN_FILTERS.map((p) => ({
                key: p,
                label: PLAN_LABELS[p],
                checked: query.plan === p,
                onSelect: () => go({ plan: p, page: 1 }),
              })),
            ]}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {filtered && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {query.q && <Chip label={`Search: “${query.q}”`} href={href({ q: "", page: 1 })} />}
          {query.status !== "all" && <Chip label={`Status: ${TABS.find((t) => t.id === query.status)?.label}`} href={href({ status: "all", page: 1 })} />}
          {query.plan && <Chip label={`Plan: ${PLAN_LABELS[query.plan]}`} href={href({ plan: null, page: 1 })} />}
          <Link href={href({ q: "", status: "all", plan: null, page: 1 })} className="px-1 font-semibold text-ink-3 hover:text-ink">
            Clear all
          </Link>
        </div>
      )}

      <div className="rounded-[22px] border border-line bg-surface">
        {/* Toolbar: search + "Showing [25 ▾] of n", or the bulk bar when rows are selected */}
        <div className="flex min-h-16 flex-wrap items-center gap-3 rounded-t-[22px] border-b border-line px-4 py-3">
          {selected.size > 0 ? (
            <div className="flex w-full flex-wrap items-center gap-2" role="toolbar" aria-label="Bulk actions">
              <span className="mr-1 text-sm font-semibold">{selected.size} selected</span>
              <BarButton disabled={pending} onClick={() => run(() => adminBulkSetUploads(ids, false))}>
                Close uploads
              </BarButton>
              <BarButton disabled={pending} onClick={() => run(() => adminBulkSetUploads(ids, true))}>
                Reopen uploads
              </BarButton>
              <BarButton danger disabled={pending} onClick={() => setConfirm({ ids, label: `${ids.length} albums` })}>
                Delete…
              </BarButton>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto h-9 px-2 text-sm font-semibold text-ink-3 hover:text-ink">
                Clear selection
              </button>
              {pending && <Spinner size={16} />}
            </div>
          ) : (
            <>
              <form action="/admin" className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 pl-4 pr-1.5 sm:max-w-sm" role="search">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-3">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                {query.status !== "all" && <input type="hidden" name="status" value={query.status} />}
                {query.plan && <input type="hidden" name="plan" value={query.plan} />}
                {query.per !== DEFAULT_ADMIN_QUERY.per && <input type="hidden" name="per" value={query.per} />}
                <input
                  ref={searchRef}
                  name="q"
                  defaultValue={query.q}
                  placeholder="Search name or album id"
                  aria-label="Search albums"
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:[box-shadow:none]"
                />
                <kbd className="mono hidden shrink-0 rounded-md border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-3 sm:block">Ctrl K</kbd>
                <button type="submit" className="h-8 rounded-full bg-btn px-3 text-xs font-semibold text-btn-ink">
                  Search
                </button>
              </form>
              <label className="ml-auto flex items-center gap-2 text-sm text-ink-3">
                Showing
                <select
                  value={query.per}
                  onChange={(e) => go({ per: Number(e.target.value), page: 1 })}
                  aria-label="Rows per page"
                  className="h-9 rounded-[10px] border border-line-strong bg-surface px-2 font-semibold text-ink outline-none"
                >
                  {ADMIN_PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>
                  of <span className="font-semibold text-ink tabular-nums">{total.toLocaleString("en-GB")}</span> {total === 1 ? "result" : "results"}
                </span>
                {navigating && <Spinner size={14} />}
              </label>
            </>
          )}
        </div>

        {confirm && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-danger-bg px-4 py-3 text-sm">
            <span className="text-danger">
              Delete <strong>{confirm.label}</strong> with every photo and file, for good? Type <strong>{confirmWord}</strong>:
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Type to confirm delete"
              className="h-9 min-w-40 flex-1 rounded-full border border-line-strong bg-surface px-3 outline-none sm:flex-none"
            />
            <button
              type="button"
              disabled={pending || typed.trim().toLowerCase() !== confirmWord.trim().toLowerCase()}
              onClick={() =>
                run(() => (confirm.ids.length === 1 ? adminDeleteEvent(confirm.ids[0], typed) : adminBulkDelete(confirm.ids, typed)))
              }
              className="flex h-9 items-center gap-1.5 rounded-full bg-danger px-3 font-semibold text-white disabled:opacity-40 dark:text-[#0E0E10]"
            >
              {pending && <Spinner size={14} />}
              Delete for good
            </button>
            <button type="button" onClick={() => (setConfirm(null), setTyped(""))} className="h-9 px-2 font-semibold text-ink-2">
              Cancel
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="border-b border-line bg-danger-bg px-4 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}

        {/* Only the page scrolls. Below lg the table can scroll sideways; from lg
            it fits, so the header can stick under the admin bar (top-16). */}
        <div className={`overflow-x-auto rounded-b-[22px] transition-opacity lg:overflow-visible ${navigating ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-16 z-20 bg-surface text-[12px] text-ink-3 shadow-[inset_0_-1px_0_var(--line)]">
              <tr>
                <th className="w-10 py-3 pl-4">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPage && !allOnPage;
                    }}
                    onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="h-4 w-4 accent-[var(--ink)]"
                  />
                </th>
                <SortHead label="Album" sort="name" query={query} href={href} />
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <SortHead label="Photos" sort="photos" query={query} href={href} right />
                <SortHead label="Guests" sort="guests" query={query} href={href} right />
                <SortHead label="Storage" sort="storage" query={query} href={href} right />
                <SortHead label="Last upload" sort="last_upload" query={query} href={href} />
                <th className="w-12 py-3 pr-4 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, index) => {
                const on = selected.has(e.id);
                return (
                  // The name's link stretches over the row, so a click anywhere
                  // opens the album; the checkbox and ⋮ sit above it.
                  <tr
                    key={e.id}
                    className={`relative cursor-pointer border-b border-line last:border-0 has-[a:focus-visible]:bg-surface-2 ${
                      on ? "bg-surface-2" : "hover:bg-surface-2"
                    }`}
                  >
                    <td className="relative z-10 py-3 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${e.name}`}
                        checked={on}
                        onChange={() => toggle(e.id)}
                        className="h-4 w-4 accent-[var(--ink)]"
                      />
                    </td>
                    <td className="max-w-[300px] px-3 py-3">
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="block truncate font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:[box-shadow:none]"
                      >
                        {e.name}
                      </Link>
                      <span className="block truncate text-xs text-ink-3">Created {formatDate(e.created_at)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill active={e.is_active} expiresAt={e.expires_at} />
                    </td>
                    <td className="px-3 py-3 text-ink-2">{e.legacy_uncapped ? "Early" : e.plan.charAt(0).toUpperCase() + e.plan.slice(1)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{e.photos.toLocaleString("en-GB")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{e.contributors.toLocaleString("en-GB")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-2">{formatBytes(Number(e.storage_bytes))}</td>
                    <td className="px-3 py-3 text-ink-2">
                      {e.last_upload ? (
                        <time dateTime={e.last_upload} title={formatDate(e.last_upload, true)} suppressHydrationWarning>
                          {timeAgo(e.last_upload)}
                        </time>
                      ) : (
                        <span className="text-ink-3">No photos</span>
                      )}
                    </td>
                    <td className={`relative py-3 pr-3 text-right ${menu === e.id ? "z-30" : "z-10"}`}>
                      <RowMenu
                        up={index >= rows.length - 2 && rows.length > 3}
                        open={menu === e.id}
                        onOpen={() => setMenu(menu === e.id ? null : e.id)}
                        onClose={() => setMenu(null)}
                        name={e.name}
                        id={e.id}
                        active={e.is_active}
                        disabled={pending}
                        onToggleUploads={() => run(() => adminSetUploads(e.id, !e.is_active))}
                        onDelete={() => (setMenu(null), setConfirm({ ids: [e.id], label: e.name }))}
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <p className="font-semibold">{filtered ? "No albums match" : "No albums yet"}</p>
                    {filtered && (
                      <>
                        <p className="mt-1 text-sm text-ink-3">Try a different search or filter.</p>
                        <Link
                          href={href({ q: "", status: "all", plan: null, page: 1 })}
                          className="mt-4 inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-surface-3"
                        >
                          Clear filters
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3">
        <span>{total > 0 ? `${from}–${to} of ${total.toLocaleString("en-GB")}` : ""}</span>
        {pages > 1 && <Pager page={query.page} pages={pages} href={(p) => href({ page: p })} />}
        <span className="hidden sm:block">
          Page {query.page} of {pages}
        </span>
      </div>
    </section>
  );
}

function Chip({ label, href }: { label: string; href: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-3 pl-3 pr-1 text-ink">
      {label}
      <Link href={href} aria-label={`Remove ${label}`} className="flex h-6 w-6 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
        ✕
      </Link>
    </span>
  );
}

type DropdownItem = { key: string; label: string; checked: boolean; onSelect: () => void } | "divider";

function Dropdown({ label, icon, active, items }: { label: string; icon: ReactNode; active: boolean; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-semibold transition-colors ${
          active ? "border-ink bg-surface" : "border-line-strong bg-surface hover:bg-surface-3"
        }`}
      >
        {icon}
        {label}
        {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-[14px] border border-line bg-surface py-1 shadow-2">
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={`d${i}`} className="my-1 border-t border-line" />
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitemradio"
                aria-checked={item.checked}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="flex h-10 w-full items-center justify-between px-3 text-left text-sm hover:bg-surface-2"
              >
                {item.label}
                {item.checked && <span aria-hidden="true">✓</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function useClickAway(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}

function SortHead({
  label,
  sort,
  query,
  href,
  right = false,
}: {
  label: string;
  sort: AdminSort;
  query: AdminListQuery;
  href: (p: Partial<AdminListQuery>) => string;
  right?: boolean;
}) {
  const active = query.sort === sort;
  // First click sorts descending (biggest / newest first), except names A→Z.
  const nextDesc = active ? !query.desc : sort !== "name";
  return (
    <th className={`px-3 py-3 font-medium ${right ? "text-right" : ""}`} aria-sort={active ? (query.desc ? "descending" : "ascending") : "none"}>
      <Link
        href={href({ sort, desc: nextDesc, page: 1 })}
        className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 12" className="shrink-0">
          <path d="M5 1 8.5 5h-7z" fill="currentColor" opacity={active && !query.desc ? 1 : 0.3} />
          <path d="M5 11 1.5 7h7z" fill="currentColor" opacity={active && query.desc ? 1 : 0.3} />
        </svg>
      </Link>
    </th>
  );
}

function RowMenu({
  open,
  onOpen,
  onClose,
  name,
  id,
  active,
  disabled,
  onToggleUploads,
  onDelete,
  up = false,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  name: string;
  id: string;
  active: boolean;
  disabled: boolean;
  onToggleUploads: () => void;
  onDelete: () => void;
  /** Open upwards (last rows, so the table's scroll area doesn't clip it). */
  up?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, open, onClose);
  const [copied, setCopied] = useState(false);

  const item = "flex h-10 w-full items-center px-3 text-left text-sm hover:bg-surface-2";
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 w-48 overflow-hidden rounded-[14px] border border-line bg-surface py-1 text-left shadow-2 ${
            up ? "bottom-10" : "top-10"
          }`}
        >
          <Link role="menuitem" href={`/admin/events/${id}`} className={item}>
            Open album
          </Link>
          <a role="menuitem" href={`/e/${id}`} target="_blank" rel="noopener noreferrer" className={item}>
            Guest view ↗
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(id).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className={item}
          >
            {copied ? "Copied ✓" : "Copy album id"}
          </button>
          <div className="my-1 border-t border-line" />
          <button role="menuitem" type="button" disabled={disabled} onClick={onToggleUploads} className={item}>
            {active ? "Close uploads" : "Reopen uploads"}
          </button>
          <button role="menuitem" type="button" onClick={onDelete} className={`${item} text-danger`}>
            Delete…
          </button>
        </div>
      )}
    </div>
  );
}

function BarButton({ children, onClick, disabled, danger = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 rounded-full px-3.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        danger ? "bg-danger-bg text-danger hover:opacity-90" : "border border-line-strong hover:bg-surface-3"
      }`}
    >
      {children}
    </button>
  );
}

/** ‹ 1 2 3 … 9 › — first, last, and the pages around the current one. */
function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const cell = "flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2 text-sm font-semibold";
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label="Previous page" className={`${cell} text-ink-2 hover:bg-surface-3`}>
          ‹
        </Link>
      ) : (
        <span className={`${cell} text-ink-3 opacity-40`}>‹</span>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
          <Link
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${cell} ${n === page ? "bg-btn text-btn-ink" : "border border-line text-ink hover:bg-surface-3"}`}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={href(page + 1)} aria-label="Next page" className={`${cell} text-ink-2 hover:bg-surface-3`}>
          ›
        </Link>
      ) : (
        <span className={`${cell} text-ink-3 opacity-40`}>›</span>
      )}
    </nav>
  );
}

function SortIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
    </svg>
  );
}
