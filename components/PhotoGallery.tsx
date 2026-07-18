"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { Photo } from "@/lib/types";
import PhotoGrid from "./PhotoGrid";

export default function PhotoGallery({
  eventId,
  initialPhotos,
}: {
  eventId: string;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);

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

  return <PhotoGrid photos={photos} />;
}
