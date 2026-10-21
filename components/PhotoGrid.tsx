"use client";

import { useState } from "react";
import Image from "next/image";
import type { Photo } from "@/lib/types";
import { getPromptById } from "@/lib/prompts";
import { avatarSwatch, initialOf, promptSwatch, timeAgo } from "@/lib/display";

type Common = {
  photos: Photo[];
  freshIds: Set<string>;
  onOpen: (index: number) => void;
  publicUrl: (path: string) => string;
};

function altFor(photo: Photo) {
  return photo.guest_name ? `Photo by ${photo.guest_name}` : "Event photo";
}

/** Image that shows a shimmer skeleton until it has loaded. */
function LoadingImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

/** 3-column, 4:5 tiles, 2px gap, edge to edge on mobile. */
export function GridView({ photos, freshIds, onOpen, publicUrl }: Common) {
  return (
    <div className="grid grid-cols-3 gap-0.5 lg:gap-1">
      {photos.map((photo, i) => {
        const prompt = getPromptById(photo.prompt_id);
        const fresh = freshIds.has(photo.id);
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Open ${altFor(photo).toLowerCase()}${prompt ? `, ${prompt.label}` : ""}`}
            className={`group relative aspect-[4/5] overflow-hidden bg-surface-2 lg:rounded-md ${fresh ? "arrive" : ""}`}
          >
            <LoadingImage
              src={publicUrl(photo.storage_path)}
              alt={altFor(photo)}
              sizes="(min-width: 1024px) 300px, 33vw"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
            {fresh && (
              <span className="absolute right-1.5 top-1.5 flex h-5 items-center rounded-full bg-white px-[7px] text-[10px] font-bold text-[#0E0E10]">
                NEW
              </span>
            )}
            {prompt && (
              <span
                aria-hidden="true"
                className="absolute bottom-1.5 left-1.5 text-[13px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              >
                {prompt.emoji}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Full-width posts: avatar initial, name, time, prompt pill, photo. */
export function FeedView({ photos, freshIds, onOpen, publicUrl }: Common) {
  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-3 pt-2.5 lg:gap-6">
      {photos.map((photo, i) => {
        const prompt = getPromptById(photo.prompt_id);
        const avatar = avatarSwatch(photo.guest_name);
        return (
          <article key={photo.id} className={freshIds.has(photo.id) ? "arrive" : ""}>
            <div className="flex h-[52px] items-center gap-2.5 px-3.5 lg:px-0">
              <span
                aria-hidden="true"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: avatar.bg, color: avatar.ink }}
              >
                {initialOf(photo.guest_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{photo.guest_name || "Guest"}</div>
                <div className="text-xs text-ink-3" suppressHydrationWarning>
                  {timeAgo(photo.created_at)}
                </div>
              </div>
              {prompt && (
                <span className="flex h-[30px] max-w-[55%] shrink-0 items-center gap-1.5 rounded-full border border-line-strong pl-1 pr-3 text-xs font-medium">
                  <span
                    aria-hidden="true"
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs"
                    style={{ background: promptSwatch(prompt.id).bg }}
                  >
                    {prompt.emoji}
                  </span>
                  <span className="truncate">{prompt.label}</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Open ${altFor(photo).toLowerCase()}`}
              className="relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-surface-2 lg:rounded-lg"
            >
              <LoadingImage
                src={publicUrl(photo.storage_path)}
                alt={altFor(photo)}
                sizes="(min-width: 1024px) 470px, 100vw"
              />
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function SkeletonGrid({ count = 9 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading photos" className="grid grid-cols-3 gap-0.5 lg:gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="skeleton aspect-[4/5] lg:rounded-md" />
      ))}
    </div>
  );
}
