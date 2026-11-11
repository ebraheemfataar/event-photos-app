"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { MAX_UPLOAD_BYTES, PASSTHROUGH_TYPES } from "@/lib/compressOptions";
import { finishPhotoUpload, startPhotoUpload } from "@/lib/uploadActions";
import { getGuestId, rememberMyPhoto } from "@/lib/guestId";
import PromptChips from "@/components/PromptChips";
import { CameraIcon, CloseIcon, ImagesIcon, PlusIcon } from "@/components/icons";
import Spinner from "@/components/Spinner";

/** A message from the server that's safe to show as-is. */
class UploadError extends Error {}

/** Most photos staged at once (well under the 50/hour guest limit). */
const MAX_STAGED = 30;

type Staged = { id: string; file: File; url: string };

/** Composer: pick photos (camera or library) → they're staged as previews →
 * add a name / prompt → "Share" uploads them through the server flow
 * (lib/uploadActions.ts). Nothing uploads until Share is tapped. */
export default function PhotoUploadForm({
  eventId,
  defaultName = "",
  hostToken,
  onUploaded,
}: {
  eventId: string;
  /** Pre-filled "Your name" (the host page passes "Host"); editable. */
  defaultName?: string;
  /** Host page: marks uploads as the host's (never rate-limited or counted as a guest). */
  hostToken?: string;
  onUploaded?: (count: number) => void;
}) {
  const [guestName, setGuestName] = useState(defaultName);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  // Every preview URL made, so they're all released when the sheet closes.
  const urlsRef = useRef(new Set<string>());

  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function release(item: Staged) {
    URL.revokeObjectURL(item.url);
    urlsRef.current.delete(item.url);
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // GIFs skip compression (to keep the animation), so they can exceed the
    // bucket's size cap. Leave those out with a note.
    const picked = Array.from(files);
    const tooBig = picked.filter((f) => PASSTHROUGH_TYPES.includes(f.type) && f.size > MAX_UPLOAD_BYTES);
    const ok = picked.filter((f) => !tooBig.includes(f));
    const room = Math.max(0, MAX_STAGED - staged.length);
    const added = ok.slice(0, room).map((file) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });

    const notes: string[] = [];
    if (tooBig.length) {
      notes.push(
        `${tooBig.length === 1 ? "1 GIF was" : `${tooBig.length} GIFs were`} over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB and ${
          tooBig.length === 1 ? "was" : "were"
        } skipped.`
      );
    }
    if (ok.length > room) notes.push(`Up to ${MAX_STAGED} photos at a time. Share these, then add more.`);
    setNotice(notes.join(" ") || null);
    setError(null);
    setStaged((s) => [...s, ...added]);
    resetInputs();
  }

  function removeStaged(id: string) {
    setStaged((s) => {
      const item = s.find((x) => x.id === id);
      if (item) release(item);
      return s.filter((x) => x.id !== id);
    });
  }

  async function share() {
    const queue = staged;
    if (queue.length === 0 || isUploading) return;
    setError(null);
    setNotice(null);
    setIsUploading(true);
    setProgress({ done: 0, total: queue.length });
    const supabase = createSupabaseClient();
    const guestId = getGuestId();
    let shared = 0;

    try {
      for (const item of queue) {
        const compressed = await compressImage(item.file);
        // 1. The server checks limits and issues a one-time upload URL.
        const start = await startPhotoUpload({ eventId, guestId, contentType: compressed.type, hostToken });
        if (!start.ok) throw new UploadError(start.error);

        // 2. Upload straight to storage with it.
        const { error: uploadError } = await supabase.storage
          .from("event-photos")
          .uploadToSignedUrl(start.path, start.token, compressed, { contentType: compressed.type });
        if (uploadError) throw uploadError;

        // 3. The server checks the file and adds it to the album.
        const done = await finishPhotoUpload({
          eventId,
          photoId: start.photoId,
          guestId,
          guestName,
          promptId: selectedPromptId,
        });
        if (!done.ok) throw new UploadError(done.error);
        rememberMyPhoto(start.photoId);

        // Drop each finished photo, so Share again only sends what's left.
        shared++;
        release(item);
        setStaged((s) => s.filter((x) => x.id !== item.id));
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      setSelectedPromptId(null);
      onUploaded?.(shared);
    } catch (e) {
      const reason = e instanceof UploadError ? e.message : "Upload failed. Check your connection and try again.";
      setError(shared > 0 ? `${shared} shared. ${reason}` : reason);
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  }

  function resetInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const count = staged.length;

  return (
    <div className="flex w-full flex-col gap-4">
      {count > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">
              {count === 1 ? "1 photo" : `${count} photos`} ready
            </span>
            {!isUploading && count < MAX_STAGED && (
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                className="flex h-9 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3"
              >
                <PlusIcon size={15} /> Add more
              </button>
            )}
          </div>
          <ul aria-label="Photos to share" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {staged.map((item, i) => (
              <li key={item.id} className="relative h-[92px] w-[74px] shrink-0 overflow-hidden rounded-[14px] bg-surface-3">
                <span className="absolute inset-0 flex items-center justify-center text-ink-3">
                  <ImagesIcon size={20} />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`Photo ${i + 1}`}
                  className="relative h-full w-full object-cover"
                  // HEIC can't preview outside Safari: keep the placeholder.
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => removeStaged(item.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <CloseIcon size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex h-13 items-center gap-2.5 rounded-[14px] border border-line-strong bg-surface-2 px-4 transition-colors focus-within:border-ink">
        <span className="whitespace-nowrap text-sm text-ink-3">Your name</span>
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="optional"
          maxLength={60}
          autoComplete="given-name"
          disabled={isUploading}
          className="h-full min-w-0 flex-1 bg-transparent text-right text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-3 focus-visible:[box-shadow:none]"
        />
      </label>

      <PromptChips selectedId={selectedPromptId} onSelect={setSelectedPromptId} />

      {progress && (
        <div role="status" aria-live="polite" className="rounded-[18px] border border-line bg-surface p-3">
          <div className="flex justify-between text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Spinner size={15} />
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
        <p role="alert" className="rounded-[14px] bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-[14px] border border-warn-line bg-warn-bg px-3 py-2.5 text-[13px] text-warn-ink">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {count > 0 ? (
          <button
            type="button"
            onClick={share}
            disabled={isUploading}
            aria-busy={isUploading}
            className={`flex h-14 items-center justify-between rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.98] ${isUploading ? "cursor-progress" : ""}`}
          >
            {isUploading ? "Sharing…" : error ? `Try again · ${count === 1 ? "1 photo" : `${count} photos`}` : `Share ${count === 1 ? "photo" : `${count} photos`}`}
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
              {isUploading ? <Spinner /> : <ArrowUp />}
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex h-14 items-center justify-between rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              Take photo
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
                <CameraIcon size={18} strokeWidth={2.2} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3"
            >
              <ImagesIcon size={18} />
              Choose from library
            </button>
          </>
        )}
        {count > 0 && !isUploading && (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3"
          >
            <CameraIcon size={18} />
            Take another
          </button>
        )}
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
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  );
}

function ArrowUp() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  );
}
