"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import EventAlbum, { type AlbumMode } from "./EventAlbum";
import { DEMO_EVENT_ID, DEMO_EVENT_NAME } from "@/lib/demoPhotos";

/** Static mock album — no Supabase, no realtime. */
export default function DemoAlbum({
  photos,
  mode,
  guestUrl,
}: {
  photos: Photo[];
  mode: AlbumMode;
  guestUrl: string;
}) {
  const [initialPhotoIds] = useState(() => new Set(photos.map((p) => p.id)));
  return (
    <EventAlbum
      demo
      eventId={DEMO_EVENT_ID}
      eventName={DEMO_EVENT_NAME}
      isActive
      createdAt={photos[photos.length - 1]?.created_at ?? new Date().toISOString()}
      photos={photos}
      initialPhotoIds={initialPhotoIds}
      mode={mode}
      guestUrl={guestUrl}
    />
  );
}
