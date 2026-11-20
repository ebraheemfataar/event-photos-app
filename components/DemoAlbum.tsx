"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import EventAlbum, { type AlbumMode } from "./EventAlbum";
import Sheet from "./Sheet";
import ThemePicker from "./ThemePicker";
import { DEMO_ADD_ONS, DEMO_PLANS, demoEvent } from "@/lib/demoPhotos";
import { planStatus } from "@/lib/plans";
import type { ValidDetails } from "@/lib/eventDetails";
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
  const [baseEvent, setBaseEvent] = useState(() =>
    demoEvent(initialPhotos[initialPhotos.length - 1]?.created_at ?? new Date().toISOString())
  );

  function applyDetails(details: ValidDetails) {
    const { theme: nextTheme, ...rest } = details;
    setBaseEvent((e) => ({ ...e, ...rest }));
    chooseTheme(nextTheme);
  }

  return (
    <>
      <EventAlbum
        demo
        event={{ ...baseEvent, theme }}
        photos={photos}
        initialPhotoIds={initialPhotoIds}
        mode={mode}
        guestUrl={guestUrl}
        onPhotoRemoved={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
        onDemoEdit={applyDetails}
        planStatus={planStatus(baseEvent, DEMO_PLANS[1], { photos: photos.length })}
        plans={DEMO_PLANS}
        showBadge={DEMO_PLANS.find((p) => p.id === baseEvent.plan)?.shows_badge ?? true}
        addOns={DEMO_ADD_ONS}
      />

      <div data-theme={theme}>
        {/* The pulse sits on this wrapper, behind the button (globals.css → .fab-pulse). */}
        <div className="fab-pulse pulse-offset fixed bottom-[calc(90px+env(safe-area-inset-bottom))] left-4 z-40 rounded-full lg:bottom-8 lg:left-[calc(244px+2rem)]">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={`Change theme (now ${themeName(theme)})`}
          className="flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-2 text-sm font-semibold text-ink shadow-2 transition-transform focus-visible:[box-shadow:var(--ring)] active:scale-95 sm:pr-4"
        >
          <span aria-hidden="true" className="flex -space-x-1.5">
            {swatches.map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border-2 border-[var(--surface)]" style={{ background: c }} />
            ))}
          </span>
          <span className="hidden sm:inline">Theme: {themeName(theme)}</span>
        </button>
        </div>

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
