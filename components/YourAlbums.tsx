"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@/components/SafeImage";
import { forgetAlbum, useMyAlbums } from "@/lib/myAlbums";
import { getMyAlbums, type MyAlbumSummary } from "@/lib/albumActions";
import { formatEventDate, monogram } from "@/lib/eventDetails";
import { ChevronRightIcon, CloseIcon } from "@/components/icons";

/** Home page: albums this browser opened as host (Phase 7a). Hidden when
 * there are none. The server confirms each saved host link before an album
 * is shown, and supplies its current name, status and photo count. */
export default function YourAlbums() {
  const saved = useMyAlbums();
  const [albums, setAlbums] = useState<MyAlbumSummary[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const key = saved.map((a) => a.id).join(",");

  useEffect(() => {
    if (saved.length === 0) return;
    let alive = true;
    getMyAlbums(saved.map(({ id, token }) => ({ id, token })))
      .then((list) => alive && setAlbums(list))
      .catch(() => alive && setAlbums([]));
    return () => {
      alive = false;
    };
    // Re-check only when the saved set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (saved.length === 0) return null;

  // Keep the browser's order (most recently opened first).
  const byId = new Map((albums ?? []).map((a) => [a.id, a]));
  const rows = saved.map((s) => ({ saved: s, album: byId.get(s.id) ?? null }));

  return (
    <section aria-labelledby="your-albums" className="mx-auto max-w-5xl scroll-mt-20 px-4 pt-10 md:px-10 md:pt-14">
      <div className="flex items-end justify-between gap-3 px-1.5">
        <div>
          <div className="mono text-[11px] text-ink-3">On this device</div>
          <h2 id="your-albums" className="hd mt-1.5 text-[28px] leading-[1.05] md:text-[36px]">
            Your albums
          </h2>
        </div>
      </div>
      {/* grid-cols-1 (minmax(0, 1fr)) so a long album name truncates instead of
          widening the card past the screen on mobile. */}
      <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ saved: s, album }) => {
          const gone = albums !== null && !album;
          const href = `/host/${s.id}?t=${s.token}`;
          return (
            <li key={s.id} className="relative flex min-w-0 items-center gap-3 rounded-[22px] border border-line bg-surface p-3 pr-2">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 text-sm font-semibold">
                {album?.cover ? <Image src={album.cover} alt="" fill sizes="56px" className="object-cover" /> : monogram(album?.name ?? s.name)}
              </span>
              <div className="min-w-0 flex-1">
                {gone ? (
                  <span className="block truncate font-semibold text-ink-3">{s.name}</span>
                ) : (
                  <Link href={href} className="block truncate font-semibold after:absolute after:inset-0 after:rounded-[22px] after:content-['']">
                    {album?.name ?? s.name}
                  </Link>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                  {albums === null ? (
                    <span className="skeleton inline-block h-3 w-28 rounded" />
                  ) : gone ? (
                    <span>No longer available</span>
                  ) : (
                    album && (
                      <>
                        <Status status={album.status} />
                        <span>
                          {album.photos.toLocaleString("en-GB")} {album.photos === 1 ? "photo" : "photos"}
                        </span>
                        {album.eventDate && <span>{formatEventDate(album.eventDate)}</span>}
                      </>
                    )
                  )}
                </div>
              </div>
              {confirming === s.id ? (
                <span className="relative z-10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      forgetAlbum(s.id);
                      setConfirming(null);
                    }}
                    className="h-9 rounded-full bg-surface-3 px-3 text-xs font-semibold"
                  >
                    Remove from list
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} aria-label="Keep it" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3">
                    <CloseIcon size={14} />
                  </button>
                </span>
              ) : (
                <span className="relative z-10 flex items-center">
                  <button
                    type="button"
                    onClick={() => setConfirming(s.id)}
                    aria-label={`Remove ${s.name} from this list`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3"
                  >
                    <CloseIcon size={14} />
                  </button>
                  {!gone && <ChevronRightIcon size={16} className="pointer-events-none text-ink-3" />}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 px-1.5 text-xs text-ink-3">
        Saved in this browser only. Removing one here doesn&apos;t delete the album; keep your host links somewhere safe.
      </p>
    </section>
  );
}

function Status({ status }: { status: MyAlbumSummary["status"] }) {
  const [label, cls] =
    status === "live" ? ["Live", "text-live"] : status === "expired" ? ["Expired", "text-danger"] : ["Closed", "text-ink-3"];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${cls}`}>
      {status === "live" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />}
      {label}
    </span>
  );
}
