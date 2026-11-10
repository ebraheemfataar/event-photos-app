"use client";

import Image from "next/image";
import type { Event } from "@/lib/types";
import { displayDomain, eventImageSrc, formatEventDate } from "@/lib/eventDetails";
import Sheet from "@/components/Sheet";
import { ArrowRightIcon, LinkIcon } from "@/components/icons";

/** Opens from the profile circle: the full poster / invitation, date, note
 * for guests and the host's links. Hosts also get "Edit event details". */
export default function EventInfoSheet({
  event,
  open,
  onClose,
  onEdit,
}: {
  event: Event;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const poster = eventImageSrc(event, "poster");
  const date = formatEventDate(event.event_date);
  const empty = !poster && !date && !event.note && event.links.length === 0;

  return (
    <Sheet open={open} onClose={onClose} title="Event info">
      <div className="flex flex-col gap-4 pb-1">
        {poster && (
          // Shown at its own shape (landscape, portrait or square): no
          // letterbox bars, never cropped, capped so text stays in view.
          <Image
            src={poster}
            alt={`${event.name} poster`}
            width={0}
            height={0}
            sizes="(min-width: 768px) 448px, 100vw"
            className="mx-auto h-auto max-h-[62dvh] w-auto max-w-full rounded-[22px] bg-surface-2 shadow-sm"
          />
        )}

        <div>
          <h3 className="event-title !text-[24px]">{event.name}</h3>
          {date && <p className="mono mt-1.5 text-[11px] text-ink-3">{date}</p>}
          {event.note && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{event.note}</p>}
        </div>

        {event.links.length > 0 && (
          <ul className="flex flex-col gap-2">
            {event.links.map((link) => (
              <li key={link.url + link.label}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex min-h-14 items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 transition-colors hover:bg-surface-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3">
                    <LinkIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{link.label}</span>
                    <span className="block truncate text-xs text-ink-3">{displayDomain(link.url)}</span>
                  </span>
                  <ArrowRightIcon size={16} className="shrink-0 text-ink-3" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {empty && !onEdit && <p className="text-[15px] text-ink-2">The host hasn&apos;t added any details yet.</p>}

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-[52px] items-center justify-center rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3"
          >
            {empty ? "Add poster, note and links" : "Edit event details"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
