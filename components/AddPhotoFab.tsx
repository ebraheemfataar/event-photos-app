"use client";

import { useEffect, useState } from "react";

/** Floating "Add photos" button, bottom-right (above the bottom bar on
 * phones), in the theme's accent colour so it stands out, with a soft
 * pulse (globals.css → .fab-pulse). A round + at rest; on hover / keyboard focus it expands to
 * "+ Add photos". Phones have no hover, so it starts expanded for a few
 * seconds to say what it does, then settles into the round button. */
export default function AddPhotoFab({ onClick, hidden = false }: { onClick: () => void; hidden?: boolean }) {
  const [peek, setPeek] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setPeek(false), 3500);
    return () => clearTimeout(t);
  }, []);

  if (hidden) return null;

  return (
    <div className="fab-in fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-30 lg:bottom-8 lg:right-8">
      <button
        type="button"
        onClick={onClick}
        aria-label="Add photos"
        data-expanded={peek || undefined}
        className="fab-pulse group relative isolate flex h-14 items-center rounded-full bg-accent pl-4 pr-4 text-accent-ink shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--accent)_70%,black),0_2px_6px_rgba(0,0,0,0.12)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_12px_30px_-6px_color-mix(in_srgb,var(--accent)_80%,black),0_3px_8px_rgba(0,0,0,0.14)] active:scale-95"
      >
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="shrink-0 transition-transform duration-300 ease-out group-hover:rotate-90 group-focus-visible:rotate-90 group-data-[expanded]:rotate-90"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-out group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] group-data-[expanded]:grid-cols-[1fr]">
          <span className="overflow-hidden whitespace-nowrap text-[15px] font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[expanded]:opacity-100">
            <span className="pl-2.5 pr-1">Add photos</span>
          </span>
        </span>
      </button>
    </div>
  );
}
