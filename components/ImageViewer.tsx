"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";

/** Full-screen view of one image (the event cover or poster), shown over
 * everything — including an open sheet. Rendered into <body> so a parent's
 * transform can't trap it. Esc / backdrop / ✕ close it; Esc and Tab are
 * caught here first so they don't also close or leave the sheet behind. */
export default function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLAnchorElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previously = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        // Two buttons: keep focus between them.
        e.preventDefault();
        e.stopImmediatePropagation();
        (document.activeElement === closeRef.current ? openRef.current : closeRef.current)?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previously?.focus();
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[70] flex flex-col bg-black/90">
      <div className="flex shrink-0 items-center justify-end gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <a
          ref={openRef}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"
        >
          Open original ↗
        </a>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      {/* Clicking the dark area around the image closes it. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element -- show the original file, uncropped and unresized */}
        <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-[14px] object-contain shadow-2xl" />
      </div>
    </div>,
    document.body
  );
}
