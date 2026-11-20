"use client";

import { EVENT_TYPES, type EventTypeId } from "@/lib/eventTypes";

/** Chips for the kind of event (create form and Edit event). */
export default function EventTypePicker({
  value,
  onChange,
  invalid = false,
}: {
  value: EventTypeId | "";
  onChange: (id: EventTypeId) => void;
  invalid?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Type of event" aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {EVENT_TYPES.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.id)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
              on
                ? "border-btn bg-btn text-btn-ink"
                : invalid
                  ? "border-danger/50 bg-surface text-ink hover:bg-surface-3"
                  : "border-line-strong bg-surface text-ink hover:bg-surface-3"
            }`}
          >
            <span aria-hidden="true">{t.emoji}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
