"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/types";
import { createSupabaseClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { MAX_UPLOAD_BYTES } from "@/lib/compressOptions";
import { LIMITS, eventImageSrc, monogram, validateDetails, type EventImageKind, type ValidDetails } from "@/lib/eventDetails";
import { finishEventImageUpload, removeEventImage, saveEventDetails, startEventImageUpload } from "@/lib/eventActions";
import type { ThemeId } from "@/lib/themes";
import Sheet from "@/components/Sheet";
import CoverCropper from "@/components/CoverCropper";
import Spinner from "@/components/Spinner";
import ThemePicker from "@/components/ThemePicker";
import { CloseIcon, ImagesIcon, PlusIcon, TrashIcon } from "@/components/icons";

const FIELD =
  "h-13 w-full rounded-[14px] border border-line-strong bg-surface-2 px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink";

type LinkRow = { label: string; url: string };

/** Host editor for event details (0008_event_details.sql). Mounted only while
 * open, so it always starts from the event's current values. Every save goes
 * through a host-token-checked Server Function (lib/eventActions.ts).
 * On /demo there's no token: `onDemoSave` applies the details to that page
 * only, and image uploads are switched off. */
export default function EditEventSheet({
  event,
  hostToken,
  onDemoSave,
  onClose,
  onSaved,
}: {
  event: Event;
  hostToken?: string;
  onDemoSave?: (details: ValidDetails) => void;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const demo = !hostToken;
  const router = useRouter();
  const [name, setName] = useState(event.name);
  const [eventDate, setEventDate] = useState(event.event_date ?? "");
  const [note, setNote] = useState(event.note ?? "");
  const [theme, setTheme] = useState<ThemeId>(event.theme);
  const [links, setLinks] = useState<LinkRow[]>(event.links.length ? event.links : []);
  const [saving, setSaving] = useState(false);
  const [busyImage, setBusyImage] = useState<EventImageKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A picked cover goes through CoverCropper before uploading.
  const [cropFile, setCropFile] = useState<File | null>(null);

  async function save() {
    setError(null);
    const input = { name, theme, eventDate, note, links };
    const checked = validateDetails(input);
    if (!checked.ok) return setError(checked.error);
    if (!hostToken) {
      onDemoSave?.(checked.value);
      onSaved("Saved on this page only (demo)");
      return onClose();
    }
    setSaving(true);
    const result = await saveEventDetails(event.id, hostToken, input);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onSaved("Event details saved");
    onClose();
  }

  async function uploadImage(kind: EventImageKind, file: File) {
    setError(null);
    if (!hostToken) return setError("Image uploads are off in the demo. Make your own album to try it.");
    setBusyImage(kind);
    try {
      const compressed = await compressImage(file);
      if (compressed.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 10 MB.");
      const start = await startEventImageUpload(event.id, hostToken, kind, compressed.type);
      if (!start.ok) throw new Error(start.error);
      const { error: uploadError } = await createSupabaseClient()
        .storage.from("event-photos")
        .uploadToSignedUrl(start.path, start.token, compressed, { contentType: compressed.type });
      if (uploadError) throw new Error("Upload failed. Check your connection and try again.");
      const done = await finishEventImageUpload(event.id, hostToken, kind, start.path);
      if (!done.ok) throw new Error(done.error);
      router.refresh();
      onSaved(kind === "cover" ? "Cover updated" : "Poster updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusyImage(null);
    }
  }

  async function removeImage(kind: EventImageKind) {
    setError(null);
    if (!hostToken) return setError("Image changes are off in the demo. Make your own album to try it.");
    setBusyImage(kind);
    const result = await removeEventImage(event.id, hostToken, kind);
    setBusyImage(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onSaved(kind === "cover" ? "Cover removed" : "Poster removed");
  }

  const cover = eventImageSrc(event, "cover");
  const poster = eventImageSrc(event, "poster");

  return (
    <Sheet open onClose={onClose} title="Edit event">
      <div className="flex flex-col gap-6 pb-1">
        {demo && (
          <p className="rounded-[14px] bg-surface-3 px-3 py-2.5 text-[13px] text-ink-2">
            Demo album: your changes show on this page only and reset when you reload.
          </p>
        )}
        <section aria-label="Cover photo or logo">
          <Label hint="Shown in the circle at the top of the album and on link previews.">Cover photo or logo</Label>
          {cropFile ? (
            <div className="mt-2">
              <CoverCropper
                file={cropFile}
                onCancel={() => setCropFile(null)}
                onConfirm={(cropped) => {
                  setCropFile(null);
                  uploadImage("cover", cropped);
                }}
                onUnsupported={() => {
                  const original = cropFile;
                  setCropFile(null);
                  uploadImage("cover", original);
                }}
              />
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <span className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2">
                {cover ? (
                  <Image src={cover} alt="Current cover" fill sizes="72px" className="object-cover" />
                ) : (
                  <span className="text-xl font-semibold" style={{ fontFamily: "var(--font-title, var(--font-display))" }}>
                    {monogram(name || event.name)}
                  </span>
                )}
                {busyImage === "cover" && <BusyOverlay />}
              </span>
              <ImageButtons
                kind="cover"
                has={Boolean(cover)}
                busy={busyImage === "cover"}
                onPick={(f) => (hostToken ? setCropFile(f) : uploadImage("cover", f))}
                onRemove={() => removeImage("cover")}
              />
            </div>
          )}
        </section>

        <section aria-label="Poster or invitation">
          <Label hint="Optional. Your invitation or poster, shown in full when guests tap the circle.">Poster or invitation</Label>
          <div className="mt-2 flex items-center gap-4">
            <span className="relative flex h-[90px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 text-ink-3">
              {poster ? <Image src={poster} alt="Current poster" fill sizes="72px" className="object-cover" /> : busyImage !== "poster" && <ImagesIcon size={22} />}
              {busyImage === "poster" && <BusyOverlay />}
            </span>
            <ImageButtons
              kind="poster"
              has={Boolean(poster)}
              busy={busyImage === "poster"}
              onPick={(f) => uploadImage("poster", f)}
              onRemove={() => removeImage("poster")}
            />
          </div>
        </section>

        <label className="flex flex-col gap-[7px]">
          <span className="text-sm font-medium">Event name</span>
          <input className={FIELD} value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-sm font-medium">
            Date <span className="text-ink-3">· optional</span>
          </span>
          <input className={FIELD} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="flex justify-between text-sm font-medium">
            <span>
              Note for guests <span className="text-ink-3">· optional</span>
            </span>
            <span className="text-xs font-normal text-ink-3">
              {note.length}/{LIMITS.note}
            </span>
          </span>
          <textarea
            className={`${FIELD} h-auto min-h-24 resize-none py-3 leading-snug`}
            value={note}
            maxLength={LIMITS.note}
            placeholder="Snap the speeches, the dance floor and anything that makes you smile."
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <section aria-label="Links">
          <Label hint="Gift registry, wedding website, livestream, menu… Guests see where each link goes.">
            Links <span className="font-normal text-ink-3">· up to {LIMITS.links}</span>
          </Label>
          <div className="mt-2 flex flex-col gap-3">
            {links.map((link, i) => (
              <div key={i} className="flex items-start gap-2 rounded-[18px] border border-line bg-surface p-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    className={`${FIELD} h-11`}
                    placeholder="Label, e.g. Gift registry"
                    aria-label={`Link ${i + 1} label`}
                    value={link.label}
                    maxLength={LIMITS.linkLabel}
                    onChange={(e) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
                  />
                  <input
                    className={`${FIELD} h-11`}
                    placeholder="https://…"
                    aria-label={`Link ${i + 1} address`}
                    inputMode="url"
                    value={link.url}
                    maxLength={LIMITS.linkUrl}
                    onChange={(e) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}
                  aria-label={`Remove link ${i + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            ))}
            {links.length < LIMITS.links && (
              <button
                type="button"
                onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}
                className="flex h-11 items-center justify-center gap-2 rounded-full border border-dashed border-line-strong text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-3"
              >
                <PlusIcon size={16} /> Add a link
              </button>
            )}
          </div>
        </section>

        <section aria-label="Theme">
          <Label hint="Colours, headings and the printed QR card. Photos are never tinted.">Theme</Label>
          <div className="mt-2">
            <ThemePicker value={theme} onChange={setTheme} />
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-[14px] bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving || busyImage !== null || cropFile !== null}
          aria-busy={saving}
          className={`flex h-14 items-center justify-center gap-2.5 rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 ${saving ? "cursor-progress" : "disabled:opacity-50"}`}
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save details"}
        </button>
      </div>
    </Sheet>
  );
}

/** Shimmer + spinner over an image that's being replaced or removed. */
function BusyOverlay() {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="skeleton absolute inset-0 opacity-80" />
      <Spinner size={22} className="relative text-ink" />
    </span>
  );
}

function Label({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div>
      <div className="text-sm font-medium">{children}</div>
      <div className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</div>
    </div>
  );
}

function ImageButtons({
  kind,
  has,
  busy,
  onPick,
  onRemove,
}: {
  kind: EventImageKind;
  has: boolean;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => input.current?.click()}
        className={`flex h-11 items-center gap-2 rounded-full bg-btn px-4 text-sm font-semibold text-btn-ink transition-opacity hover:opacity-90 ${busy ? "cursor-progress" : "disabled:opacity-50"}`}
      >
        {busy && <Spinner size={16} />}
        {busy ? "Uploading…" : has ? `Change ${kind}` : `Upload ${kind}`}
      </button>
      {has && (
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove ${kind}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-danger transition-colors hover:bg-danger-bg disabled:opacity-50"
        >
          <TrashIcon size={17} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        className="hidden"
        aria-label={`Choose ${kind} image`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}
