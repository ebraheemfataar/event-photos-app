"use client";

import { THEMES, type ThemeId } from "@/lib/themes";

/** Radio list of event themes, each previewed in its own colours and font.
 * Used on /demo now; the create form and host settings will reuse it. */
export default function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Event theme" className="flex flex-col gap-2">
      {THEMES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.id)}
            // Each option renders inside its own theme so the preview is real.
            data-theme={t.id}
            className={`flex min-h-[68px] items-center gap-3 rounded-[18px] border bg-bg p-3 text-left text-ink transition-transform active:scale-[0.98] ${
              selected ? "border-ink border-2" : "border-line"
            }`}
          >
            <span aria-hidden="true" className="relative h-11 w-11 shrink-0 rounded-full p-[3px]" style={{ background: "var(--live-ring)" }}>
              <span className="block h-full w-full rounded-full border-2 border-[var(--bg)] bg-accent" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="event-title block !text-[17px]">{t.name}</span>
              <span className="block truncate text-[13px] text-ink-3">{t.hint}</span>
            </span>
            <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
              <span className="h-5 w-5 rounded-full border border-line bg-surface" />
              <span className="h-5 w-5 rounded-full bg-btn" />
              <span className="h-5 w-5 rounded-full bg-[var(--card-strip)]" />
            </span>
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                selected ? "border-ink" : "border-line-strong"
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
