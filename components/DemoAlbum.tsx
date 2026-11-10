"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import EventAlbum, { type AlbumMode } from "./EventAlbum";
import { DEMO_EVENT_ID, DEMO_EVENT_NAME } from "@/lib/demoPhotos";

/** Static mock album — no Supabase, no realtime. Host removals only change
 * this page's state (reload to get the photos back). */
export default function DemoAlbum({
  photos: initialPhotos,
  mode,
  guestUrl,
}: {
  photos: Photo[];
  mode: AlbumMode;
  guestUrl: string;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [initialPhotoIds] = useState(() => new Set(initialPhotos.map((p) => p.id)));
  return (
    <EventAlbum
      demo
      eventId={DEMO_EVENT_ID}
      eventName={DEMO_EVENT_NAME}
      isActive
      createdAt={initialPhotos[initialPhotos.length - 1]?.created_at ?? new Date().toISOString()}
      photos={photos}
      initialPhotoIds={initialPhotoIds}
      mode={mode}
      guestUrl={guestUrl}
      onPhotoRemoved={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
    />
  );
}
