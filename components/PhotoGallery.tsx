"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { fetchEventPhotos } from "@/lib/photoActions";
import type { Photo } from "@/lib/types";
import EventAlbum, { type EventAlbumProps } from "./EventAlbum";

export default function PhotoGallery({
  initialPhotos,
  ...albumProps
}: {
  initialPhotos: Photo[];
} & Omit<EventAlbumProps, "photos" | "initialPhotoIds" | "onPhotoRemoved">) {
  const eventId = albumProps.event.id;
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
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
        setPhotos((prev) => {
          const kept = removed.size ? prev.filter((p) => !removed.has(p.id)) : prev;
          const fresh = added.filter((p) => !kept.some((k) => k.id === p.id));
          return fresh.length ? [...fresh, ...kept] : kept;
        });
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
      onPhotoRemoved={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
      {...albumProps}
    />
  );
}
