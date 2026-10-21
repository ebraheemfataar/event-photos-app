"use client";

import { useRef, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
import PromptChips from "@/components/PromptChips";
import { CameraIcon, ImagesIcon } from "@/components/icons";

export default function PhotoUploadForm({
  eventId,
  onUploaded,
}: {
  eventId: string;
  onUploaded?: (count: number) => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  // Files from the last attempt, so the error card can offer Retry.
  const lastFilesRef = useRef<File[]>([]);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    lastFilesRef.current = fileList;

    setIsUploading(true);
    setError(null);
    setProgress({ done: 0, total: fileList.length });
    const supabase = createSupabaseClient();

    try {
      for (const file of fileList) {
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
          prompt_id: selectedPromptId,
        });
        if (insertError) throw insertError;
        // Drop each finished file so Retry only re-sends what's left.
        lastFilesRef.current = lastFilesRef.current.filter((f) => f !== file);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      setSelectedPromptId(null);
      onUploaded?.(fileList.length);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setProgress(null);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <label className="flex h-13 items-center gap-2.5 rounded-[14px] border border-line-strong bg-surface-2 px-4 transition-colors focus-within:border-ink">
        <span className="whitespace-nowrap text-sm text-ink-3">Your name</span>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="optional"
          maxLength={60}
          autoComplete="given-name"
          className="h-full min-w-0 flex-1 bg-transparent text-right text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-3 focus-visible:shadow-none"
        />
      </label>

      <PromptChips selectedId={selectedPromptId} onSelect={setSelectedPromptId} />

      {progress && (
        <div role="status" aria-live="polite" className="rounded-[18px] border border-line bg-surface p-3">
          <div className="flex justify-between text-sm font-semibold">
            <span>
              Posting {Math.min(progress.done + 1, progress.total)} of {progress.total}…
            </span>
            <span className="mono text-[11px] text-ink-2">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-[5px] overflow-hidden rounded-full bg-surface-3"
          >
            <div className="bar h-full transition-[width]" style={{ width: `${Math.max(pct, 8)}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-[14px] bg-danger-bg py-2.5 pl-3 pr-2.5 text-[13px] text-danger">
          <span className="flex-1">{error} Check your connection.</span>
          <button
            type="button"
            onClick={() => handleFiles(lastFilesRef.current)}
            className="h-11 shrink-0 rounded-full border border-current px-4 text-[13px] font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => cameraInputRef.current?.click()}
          className="flex h-14 items-center justify-between rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Take photo"}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[#0E0E10]">
            <CameraIcon size={18} strokeWidth={2.2} />
          </span>
        </button>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => libraryInputRef.current?.click()}
          className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          <ImagesIcon size={18} />
          Choose from library
        </button>
        <p className="mt-1 text-center text-xs text-ink-3">
          Resized before upload · everyone at the event can see them
        </p>
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
