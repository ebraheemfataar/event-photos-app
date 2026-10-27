"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { fetchEventPhoto } from "@/lib/photoActions";
import type { Photo } from "@/lib/types";
import EventAlbum, { type EventAlbumProps } from "./EventAlbum";

export default function PhotoGallery({
  eventId,
  initialPhotos,
  ...albumProps
}: {
  eventId: string;
  initialPhotos: Photo[];
} & Omit<EventAlbumProps, "eventId" | "photos" | "initialPhotoIds">) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  // Photos present on first render; anything else arrived live and animates in.
  const [initialPhotoIds] = useState(() => new Set(initialPhotos.map((p) => p.id)));

  useEffect(() => {
    // A database trigger (0007_lock_down_reads.sql) broadcasts only the photo
    // id on `event:<id>`. Anyone can send on a public channel, so every
    // message is checked with the server before the album changes.
    const supabase = createSupabaseClient();
    const idOf = (payload: unknown) => {
      const id = (payload as { payload?: { id?: unknown } })?.payload?.id;
      return typeof id === "string" ? id : null;
    };

    const channel = supabase
      .channel(`event:${eventId}`)
      .on("broadcast", { event: "photo_inserted" }, async (message) => {
        const id = idOf(message);
        if (!id) return;
        const photo = await fetchEventPhoto(eventId, id);
        if (!photo) return;
        setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev]));
      })
      .on("broadcast", { event: "photo_deleted" }, async (message) => {
        const id = idOf(message);
        if (!id) return;
        // Only drop it if the server confirms it's really gone.
        if (await fetchEventPhoto(eventId, id)) return;
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return (
    <EventAlbum
      eventId={eventId}
      photos={photos}
      initialPhotoIds={initialPhotoIds}
      {...albumProps}
    />
  );
}
