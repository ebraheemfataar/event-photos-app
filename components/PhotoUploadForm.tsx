"use client";

import { useRef, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";

export default function PhotoUploadForm({ eventId }: { eventId: string }) {
  const [guestName, setGuestName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    const supabase = createSupabaseClient();

    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const photoId = crypto.randomUUID();
        const path = `${eventId}/${photoId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("event-photos")
          .upload(path, compressed, { contentType: compressed.type });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("photos").insert({
          id: photoId,
          event_id: eventId,
          storage_path: path,
          guest_name: guestName.trim() || null,
          content_type: compressed.type,
        });
        if (insertError) throw insertError;
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-2 text-left">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Your name (optional)
        </span>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Jamie"
          maxLength={60}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isUploading ? "Uploading..." : "Take photo"}
        </button>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => libraryInputRef.current?.click()}
          className="flex-1 rounded-full border border-zinc-300 px-4 py-3 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Choose photo
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
