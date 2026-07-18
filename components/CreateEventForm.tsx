"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

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
    const { data, error: insertError } = await supabase
      .from("events")
      .insert({ name: name.trim() })
      .select("id, host_token")
      .single();

    if (insertError || !data) {
      setError("Something went wrong creating your event. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/host/${data.id}?t=${data.host_token}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <label className="flex flex-col gap-2 text-left">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Event name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam & Alex's Wedding"
          maxLength={100}
          required
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-zinc-900 px-5 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isSubmitting ? "Creating..." : "Create event"}
      </button>
    </form>
  );
}
