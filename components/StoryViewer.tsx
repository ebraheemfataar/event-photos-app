"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Photo } from "@/lib/types";
import { getPromptById } from "@/lib/prompts";
import { photoSrc } from "@/lib/photoSrc";
import { avatarSwatch, initialOf, timeAgo } from "@/lib/display";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/icons";

const MAX_SEGMENTS = 20;

/** Full-screen story-style viewer: tap / swipe / arrow keys to move, swipe down or Esc to close. */
export default function StoryViewer({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const photo = photos[index];
  const total = photos.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  const nav = useRef({ prev: () => {}, next: () => {}, close: onClose });
  useEffect(() => {
    nav.current = {
      prev: () => hasPrev && onIndexChange(index - 1),
      next: () => hasNext && onIndexChange(index + 1),
      close: onClose,
    };
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") nav.current.close();
      if (e.key === "ArrowLeft") nav.current.prev();
      if (e.key === "ArrowRight") nav.current.next();
      if (e.key === "Tab" && dialogRef.current) {
        // Trap focus inside the viewer.
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (items.length === 0) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, []);

  if (!photo) return null;

  const prompt = getPromptById(photo.prompt_id);
  const avatar = avatarSwatch(photo.guest_name);
  const name = photo.guest_name || "Guest";
  const segmented = total <= MAX_SEGMENTS;

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) nav.current.prev();
    else nav.current.next();
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
    } else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nav.current.next();
      else nav.current.prev();
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo by ${name}, ${index + 1} of ${total}`}
      className="fixed inset-0 z-50 flex justify-center bg-black"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative flex h-full w-full max-w-[560px] flex-col">
        <div className="relative flex-1 overflow-hidden bg-[#111113] md:my-4 md:rounded-[28px]">
          {loadedId !== photo.id && <div aria-hidden="true" className="skeleton absolute inset-0 opacity-20" />}
          <Image
            key={photo.id}
            src={photoSrc(photo)}
            alt={prompt ? `${prompt.label} — photo by ${name}` : `Photo by ${name}`}
            fill
            sizes="(min-width: 768px) 560px, 100vw"
            loading="eager"
            onLoad={() => setLoadedId(photo.id)}
            className="object-contain"
          />

          {/* Tap zones: left third = previous, rest = next. */}
          <div aria-hidden="true" className="absolute inset-0 top-20 cursor-pointer" onClick={handleTap} />

          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/45 to-transparent" />

          <div
            role="progressbar"
            aria-label={`Photo ${index + 1} of ${total}`}
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={total}
            className="pointer-events-none absolute inset-x-2.5 top-3 flex gap-1"
          >
            {segmented ? (
              photos.map((p, i) => (
                <span key={p.id} className={`h-[3px] flex-1 rounded-sm ${i <= index ? "bg-white" : "bg-white/40"}`} />
              ))
            ) : (
              <span className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/40">
                <span className="block h-full bg-white" style={{ width: `${((index + 1) / total) * 100}%` }} />
              </span>
            )}
          </div>

          <div className="absolute inset-x-3 top-6 flex items-center gap-2.5 pr-0 text-white">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-white text-sm font-semibold"
              style={{ background: avatar.bg, color: avatar.ink }}
            >
              {initialOf(photo.guest_name)}
            </span>
            <div className="min-w-0 flex-1 truncate text-sm">
              <span className="font-semibold">{name}</span>{" "}
              <span className="opacity-80" suppressHydrationWarning>
                · {timeAgo(photo.created_at)}
              </span>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15"
            >
              <CloseIcon size={24} />
            </button>
          </div>

          {prompt && (
            <div className="pointer-events-none absolute left-1/2 top-[110px] w-48 -translate-x-1/2 -rotate-6 rounded-[18px] bg-white px-3.5 py-3 text-center text-[#0E0E10] shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <div aria-hidden="true" className="text-[30px] leading-none">
                {prompt.emoji}
              </div>
              <div className="mt-1.5 text-base font-semibold leading-tight tracking-[-0.03em]">{prompt.label}</div>
            </div>
          )}
        </div>

        <div className="flex h-[88px] shrink-0 items-center justify-between gap-3 px-4 pb-[env(safe-area-inset-bottom)] text-white md:h-16">
          <button
            type="button"
            onClick={() => nav.current.prev()}
            disabled={!hasPrev}
            aria-label="Previous photo"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0E0E10] transition-opacity disabled:opacity-30"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <span className="mono text-[11px] text-white/70">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => nav.current.next()}
            disabled={!hasNext}
            aria-label="Next photo"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0E0E10] transition-opacity disabled:opacity-30"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
