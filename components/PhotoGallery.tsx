"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
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
    const supabase = createSupabaseClient();
    const channel = supabase
      .channel(`event-${eventId}-photos`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newPhoto = payload.new as Photo;
          setPhotos((prev) =>
            prev.some((p) => p.id === newPhoto.id) ? prev : [newPhoto, ...prev]
          );
        }
      )
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
