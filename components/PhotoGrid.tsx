"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Photo } from "@/lib/types";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  useEffect(() => {
    if (!openPhotoId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPhotoId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openPhotoId]);

  if (photos.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No photos yet — be the first to upload one!
      </p>
    );
  }

  const supabase = createSupabaseClient();
  const publicUrl = (path: string) =>
    supabase.storage.from("event-photos").getPublicUrl(path).data.publicUrl;

  const openPhoto = photos.find((p) => p.id === openPhotoId) ?? null;

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenPhotoId(photo.id)}
            className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 text-left dark:bg-zinc-900"
          >
            <Image
              src={publicUrl(photo.storage_path)}
              alt={
                photo.guest_name ? `Photo by ${photo.guest_name}` : "Event photo"
              }
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              className="object-cover"
            />
            {photo.guest_name && (
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-xs text-white">
                {photo.guest_name}
              </span>
            )}
          </button>
        ))}
      </div>

      {openPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenPhotoId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpenPhotoId(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
          >
            ×
          </button>
          <div className="relative h-full max-h-[90vh] w-full max-w-3xl">
            <Image
              src={publicUrl(openPhoto.storage_path)}
              alt={
                openPhoto.guest_name
                  ? `Photo by ${openPhoto.guest_name}`
                  : "Event photo"
              }
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
          {openPhoto.guest_name && (
            <p className="absolute bottom-6 text-sm text-white/80">
              {openPhoto.guest_name}
            </p>
          )}
        </div>
      )}
    </>
  );
}
