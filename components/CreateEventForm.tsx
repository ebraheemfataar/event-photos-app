"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { LIMITS, validateDetails } from "@/lib/eventDetails";
import { DEFAULT_THEME, THEMES, type ThemeId } from "@/lib/themes";
import { ArrowRightIcon } from "@/components/icons";

const FIELD =
  "h-13 rounded-[14px] border border-line-strong bg-surface-2 px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink";

export default function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [note, setNote] = useState("");
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const checked = validateDetails({ name, theme, eventDate, note, links: [] });
    if (!checked.ok) return setError(checked.error);

    setIsSubmitting(true);
    setError(null);

    const supabase = createSupabaseClient();
    // create_event (0003, extended in 0008) is the only way anon can create
    // an event, and the only time the host_token is ever returned. The cover,
    // poster and links are added afterwards on the host page.
    const { data, error: insertError } = await supabase
      .rpc("create_event", {
        p_name: checked.value.name,
        p_theme: checked.value.theme,
        p_event_date: checked.value.event_date,
        p_note: checked.value.note,
      })
      .single<{ id: string; host_token: string }>();

    if (insertError || !data) {
      setError("Something went wrong creating your event. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/host/${data.id}?t=${data.host_token}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3.5 text-left">
      <label className="flex flex-col gap-[7px]">
        <span className="text-sm font-medium">Event name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam & Alex's Wedding"
          maxLength={LIMITS.name}
          required
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-[7px]">
        <span className="text-sm font-medium">
          Date <span className="text-ink-3">· optional</span>
        </span>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={FIELD} />
      </label>

      <label className="flex flex-col gap-[7px]">
        <span className="text-sm font-medium">
          Note for guests <span className="text-ink-3">· optional</span>
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={LIMITS.note}
          placeholder="Snap the speeches and the dance floor."
          className={`${FIELD} h-auto resize-none py-3.5 leading-snug`}
        />
      </label>

      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] text-sm font-medium">
          Theme <span className="text-ink-3">· change it any time</span>
        </legend>
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
          {THEMES.map((t) => {
            const selected = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(t.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors ${
                  selected ? "border-btn bg-btn text-btn-ink" : "border-line-strong bg-surface text-ink hover:bg-surface-3"
                }`}
              >
                <span aria-hidden="true" className="flex -space-x-1.5">
                  {t.swatches.map((c) => (
                    <span key={c} className="h-5 w-5 rounded-full border-2 border-white/80" style={{ background: c }} />
                  ))}
                </span>
                {t.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-[14px] bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 flex h-14 items-center justify-between rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create event"}
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
          <ArrowRightIcon size={18} />
        </span>
      </button>
      <p className="text-center text-[13px] text-ink-3">Guests never need an account. Add a cover, poster and links next.</p>
    </form>
  );
}
