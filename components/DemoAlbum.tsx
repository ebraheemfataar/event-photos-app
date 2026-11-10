"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import EventAlbum, { type AlbumMode } from "./EventAlbum";
import Sheet from "./Sheet";
import ThemePicker from "./ThemePicker";
import { DEMO_EVENT_ID, DEMO_EVENT_NAME } from "@/lib/demoPhotos";
import { THEMES, themeName, type ThemeId } from "@/lib/themes";

/** Static mock album — no Supabase, no realtime. Host removals only change
 * this page's state (reload to get the photos back). A floating "Theme"
 * button previews the event themes; the choice is kept in ?theme=. */
export default function DemoAlbum({
  photos: initialPhotos,
  mode,
  guestUrl,
  theme: initialTheme,
}: {
  photos: Photo[];
  mode: AlbumMode;
  guestUrl: string;
  theme: ThemeId;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [initialPhotoIds] = useState(() => new Set(initialPhotos.map((p) => p.id)));
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [pickerOpen, setPickerOpen] = useState(false);

  function chooseTheme(next: ThemeId) {
    setTheme(next);
    // Keep the choice in the address so a look can be shared or reloaded.
    const url = new URL(window.location.href);
    if (next === "classic") url.searchParams.delete("theme");
    else url.searchParams.set("theme", next);
    window.history.replaceState(null, "", url);
  }

  const swatches = THEMES.find((t) => t.id === theme)?.swatches ?? [];

  return (
    <>
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
        theme={theme}
        onPhotoRemoved={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
      />

      <div data-theme={theme}>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={`Change theme (now ${themeName(theme)})`}
          className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface pl-2 pr-4 text-sm font-semibold text-ink shadow-2 transition-transform active:scale-95 lg:bottom-8 lg:left-auto lg:right-8 lg:translate-x-0 whitespace-nowrap"
        >
          <span aria-hidden="true" className="flex -space-x-1.5">
            {swatches.map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border-2 border-[var(--surface)]" style={{ background: c }} />
            ))}
          </span>
          Theme: {themeName(theme)}
        </button>

        <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Event theme">
          <p className="mb-3 text-sm text-ink-2">
            Changes the album&apos;s colours, headings and the printed QR card. Photos are never tinted.
          </p>
          <ThemePicker value={theme} onChange={chooseTheme} />
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-btn text-base font-semibold text-btn-ink"
          >
            Done
          </button>
        </Sheet>
      </div>
    </>
  );
}
