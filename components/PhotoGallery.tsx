"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { fetchEventPhotos, fetchOlderPhotos } from "@/lib/photoActions";
import { PHOTO_PAGE_SIZE } from "@/lib/paging";
import type { Photo } from "@/lib/types";
import EventAlbum, { type EventAlbumProps } from "./EventAlbum";

export default function PhotoGallery({
  initialPhotos,
  initialStats,
  ...albumProps
}: {
  initialPhotos: Photo[];
  /** Album totals from the server (photos, distinct guest names). */
  initialStats: { photos: number; guests: number };
} & Omit<EventAlbumProps, "photos" | "initialPhotoIds" | "onPhotoRemoved" | "totals" | "hasMore" | "onLoadMore" | "loadingMore">) {
  const eventId = albumProps.event.id;
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  // Paged loading: the first page came from the server; older ones on scroll.
  const [hasMore, setHasMore] = useState(initialPhotos.length >= PHOTO_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  // Totals for the header, kept in step with live adds / removes.
  const [totals, setTotals] = useState(initialStats);
  // Latest list for the live-update handler (it runs outside render).
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  });

  /** Apply verified live changes to the list and the header totals. */
  function applyChanges(removed: Set<string>, added: Photo[]) {
    const prev = photosRef.current;
    const kept = removed.size ? prev.filter((p) => !removed.has(p.id)) : prev;
    const fresh = added.filter((p) => !kept.some((k) => k.id === p.id));
    const removedCount = prev.length - kept.length;
    if (fresh.length === 0 && removedCount === 0) return;
    const known = new Set(prev.map((p) => p.guest_name?.trim().toLowerCase()).filter(Boolean));
    const newNames = new Set(fresh.map((p) => p.guest_name?.trim().toLowerCase()).filter((n) => n && !known.has(n)));
    const next = fresh.length ? [...fresh, ...kept] : kept;
    photosRef.current = next;
    setPhotos(next);
    setTotals((t) => ({ photos: Math.max(0, t.photos + fresh.length - removedCount), guests: t.guests + newNames.size }));
  }

  async function loadMore() {
    const last = photos[photos.length - 1];
    if (!hasMore || loadingMore || !last) return;
    setLoadingMore(true);
    try {
      const older = await fetchOlderPhotos(eventId, { createdAt: last.created_at, id: last.id });
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...older.filter((p) => !seen.has(p.id))];
      });
      if (older.length < PHOTO_PAGE_SIZE) setHasMore(false);
    } catch {
      // Try again on the next scroll.
    } finally {
      setLoadingMore(false);
    }
  }
  // Photos present on first render; anything else arrived live and animates in.
  const [initialPhotoIds] = useState(() => new Set(initialPhotos.map((p) => p.id)));

  useEffect(() => {
    // A database trigger (0007_lock_down_reads.sql) broadcasts only the photo
    // id on `event:<id>`. Anyone can send on a public channel, so every
    // message is checked with the server before the album changes. Messages
    // that arrive close together are checked in one call: Next runs a page's
    // Server Function calls one at a time, so one call per upload would queue
    // up behind each other at a busy event.
    const supabase = createSupabaseClient();
    const pending = new Map<string, "inserted" | "deleted">();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let flushing = false;
    let cancelled = false;

    async function flush() {
      timer = null;
      flushing = true;
      const batch = [...pending.entries()].slice(0, 100);
      batch.forEach(([id]) => pending.delete(id));
      try {
        const rows = await fetchEventPhotos(eventId, batch.map(([id]) => id));
        if (cancelled) return;
        const found = new Map(rows.map((p) => [p.id, p]));
        // Removed: the trigger said deleted and the server confirms it's gone.
        const removed = new Set(batch.filter(([id, kind]) => kind === "deleted" && !found.has(id)).map(([id]) => id));
        // Added: real rows the trigger announced, newest first.
        const added = batch
          .filter(([id, kind]) => kind === "inserted" && found.has(id))
          .map(([id]) => found.get(id)!)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (removed.size === 0 && added.length === 0) return;
        applyChanges(removed, added);
      } catch {
        // Network hiccup: the photos still show up on the next page load.
      } finally {
        flushing = false;
        if (!cancelled && pending.size > 0) schedule();
      }
    }

    function schedule() {
      if (timer || flushing) return;
      timer = setTimeout(flush, 150);
    }

    function enqueue(message: unknown, kind: "inserted" | "deleted") {
      const id = (message as { payload?: { id?: unknown } })?.payload?.id;
      if (typeof id !== "string" || id.length > 64) return;
      pending.set(id, kind);
      schedule();
    }

    const channel = supabase
      .channel(`event:${eventId}`)
      .on("broadcast", { event: "photo_inserted" }, (message) => enqueue(message, "inserted"))
      .on("broadcast", { event: "photo_deleted" }, (message) => enqueue(message, "deleted"))
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return (
    <EventAlbum
      photos={photos}
      initialPhotoIds={initialPhotoIds}
      onPhotoRemoved={(id) => applyChanges(new Set([id]), [])}
      totals={totals}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      {...albumProps}
    />
  );
}
