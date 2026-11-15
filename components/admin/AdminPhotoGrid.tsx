"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/types";
import { photoSrc } from "@/lib/photoSrc";
import { adminDeletePhoto } from "@/lib/admin/actions";
import { TrashIcon } from "@/components/icons";
import Spinner from "@/components/Spinner";

/** Admin photo grid: tap the bin once to arm it, again to delete. */
export default function AdminPhotoGrid({ eventId, photos }: { eventId: string; photos: Photo[] }) {
  const router = useRouter();
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (armed !== id) return setArmed(id);
    setBusy(id);
    setError(null);
    const r = await adminDeletePhoto(eventId, id);
    setBusy(null);
    setArmed(null);
    if (!r.ok) return setError(r.error);
    setGone((g) => new Set(g).add(id));
    router.refresh();
  }

  const shown = photos.filter((p) => !gone.has(p.id));
  if (shown.length === 0) return <p className="rounded-[18px] border border-line bg-surface px-4 py-8 text-center text-sm text-ink-3">No photos.</p>;

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 rounded-[12px] bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
        {shown.map((p) => (
          <li key={p.id} data-photo-id={p.id} className="group relative aspect-square overflow-hidden rounded-[12px] bg-surface-3">
            <Image src={photoSrc(p)} alt={p.guest_name ? `Photo by ${p.guest_name}` : "Photo"} fill sizes="160px" className="object-cover" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 text-[11px] text-white">
              {p.guest_name || "Guest"}
            </span>
            <button
              type="button"
              onClick={() => remove(p.id)}
              onBlur={() => armed === p.id && busy !== p.id && setArmed(null)}
              aria-label={armed === p.id ? "Confirm delete photo" : "Delete photo"}
              className={`absolute right-1.5 top-1.5 flex h-9 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold text-white transition-colors ${
                armed === p.id ? "bg-danger" : "bg-black/55 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              }`}
            >
              {busy === p.id ? <Spinner size={14} /> : <TrashIcon size={14} />}
              {armed === p.id && busy !== p.id && "Delete?"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
