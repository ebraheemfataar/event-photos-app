"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { ArrowRightIcon } from "@/components/icons";

export default function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const supabase = createSupabaseClient();
    // create_event (0003_lock_down_host_token.sql) is the only way anon can
    // create an event, and the only time the host_token is ever returned.
    const { data, error: insertError } = await supabase
      .rpc("create_event", { p_name: name.trim() })
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
          maxLength={100}
          required
          className="h-13 rounded-[14px] border border-line-strong bg-surface-2 px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
        />
      </label>

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
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[#0E0E10]">
          <ArrowRightIcon size={18} />
        </span>
      </button>
      <p className="text-center text-[13px] text-ink-3">Guests never need an account.</p>
    </form>
  );
}
