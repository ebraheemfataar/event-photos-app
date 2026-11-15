"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteEvent, adminSetUploads } from "@/lib/admin/actions";
import Spinner from "@/components/Spinner";

/** Right-hand panel on an admin album page: open, close/reopen, delete. */
export default function AdminEventActions({
  eventId,
  name,
  active,
  hostPath,
  guestPath,
}: {
  eventId: string;
  name: string;
  active: boolean;
  hostPath: string;
  guestPath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  function toggleUploads() {
    setError(null);
    start(async () => {
      const r = await adminSetUploads(eventId, !active);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  async function deleteAlbum() {
    setError(null);
    setDeleting(true);
    const r = await adminDeleteEvent(eventId, typed);
    if (!r.ok) {
      setDeleting(false);
      setError(r.error);
      return;
    }
    router.push(`/admin?deleted=${encodeURIComponent(name)}`);
  }

  const btn = "flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-surface-3";

  return (
    <section className="flex flex-col gap-2.5 rounded-[22px] border border-line bg-surface p-4">
      <h2 className="text-base font-semibold">Actions</h2>
      <a href={hostPath} target="_blank" rel="noopener noreferrer" className={btn}>
        Open as host ↗
      </a>
      <a href={guestPath} target="_blank" rel="noopener noreferrer" className={btn}>
        Open guest view ↗
      </a>
      <button type="button" onClick={toggleUploads} disabled={pending} aria-busy={pending} className={btn}>
        {pending && <Spinner size={16} />}
        {active ? "Close uploads" : "Reopen uploads"}
      </button>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex h-11 items-center justify-center rounded-full bg-danger-bg text-sm font-semibold text-danger hover:opacity-90"
        >
          Delete album…
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-[18px] border border-danger/40 p-3">
          <p className="text-sm">
            This deletes <strong>{name}</strong>, every photo and every file, for good. Type the album&apos;s name to confirm.
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Type the album name to confirm"
            placeholder={name}
            className="h-11 rounded-[12px] border border-line-strong bg-surface-2 px-3 text-sm outline-none focus:border-ink"
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => (setConfirmOpen(false), setTyped(""))} className={btn} disabled={deleting}>
              Cancel
            </button>
            <button
              type="button"
              onClick={deleteAlbum}
              disabled={deleting || typed.trim() !== name.trim()}
              aria-busy={deleting}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-danger text-sm font-semibold text-white disabled:opacity-40 dark:text-[#0E0E10]"
            >
              {deleting && <Spinner size={16} />}
              {deleting ? "Deleting…" : "Delete for good"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[12px] bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
