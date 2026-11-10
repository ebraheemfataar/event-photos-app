"use client";

import Image from "next/image";
import type { Event } from "@/lib/types";
import { eventImageSrc, monogram } from "@/lib/eventDetails";
import { PlusIcon } from "@/components/icons";

/** The round profile picture: the host's cover image, or the event's
 * monogram in the theme's style. Never a guest photo. Tapping opens event
 * info; for a host without a cover it shows a "+" to nudge them to add one. */
export default function EventCover({
  event,
  live,
  size,
  showAddHint,
  beckon = false,
  onClick,
}: {
  event: Pick<Event, "id" | "name" | "cover_path" | "poster_path">;
  live: boolean;
  size: number;
  showAddHint: boolean;
  /** Play the periodic "droplet" ripple that invites a tap. */
  beckon?: boolean;
  onClick: () => void;
}) {
  const src = eventImageSrc(event, "cover");
  const pad = size > 100 ? 4 : 3;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={showAddHint ? "Add a cover photo or logo" : `About ${event.name}`}
      className={`relative block shrink-0 rounded-full transition-transform active:scale-95 ${beckon ? "droplet" : ""}`}
      style={{ width: size, height: size, padding: pad, background: live ? "var(--live-ring)" : "var(--line-strong)" }}
    >
      <span
        className="droplet-body relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface-2 text-ink"
        style={{ border: `${size > 100 ? 5 : 3}px solid var(--bg)` }}
      >
        {src ? (
          <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="select-none leading-none"
            style={{
              fontFamily: "var(--font-title, var(--font-display))",
              fontWeight: 600,
              fontSize: Math.round(size * 0.3),
              letterSpacing: "-0.02em",
            }}
          >
            {monogram(event.name)}
          </span>
        )}
      </span>
      {showAddHint && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-[3px] border-[var(--bg)] bg-btn text-btn-ink"
          style={{ width: size > 100 ? 40 : 30, height: size > 100 ? 40 : 30 }}
        >
          <PlusIcon size={size > 100 ? 20 : 15} strokeWidth={2.8} />
        </span>
      )}
    </button>
  );
}
