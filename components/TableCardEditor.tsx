"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sheet from "@/components/Sheet";
import Spinner from "@/components/Spinner";
import { TentFace } from "@/components/TableTent";
import { PrinterIcon } from "@/components/icons";
import { CARD_TEXT_LABELS, CARD_TEXT_LIMITS, DEFAULT_CARD_TEXT, cardTextFor, validateCardText, type CardText } from "@/lib/cardText";
import { saveCardText } from "@/lib/eventActions";

const FIELD =
  "h-12 w-full rounded-[14px] border border-line-strong bg-surface-2 px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink";

// A4 half page, where one face of the folded tent sits (TableTent).
const FACE_W_MM = 210;
const FACE_H_MM = 148;
const PX_PER_MM = 96 / 25.4;

/** "Print table card": a live preview of the folded card, and a choice
 * between the default wording and the host's own (three lines). Saving
 * goes through saveCardText (host token checked on the server); on the demo
 * (no token) the text only lives on this page. */
export default function TableCardEditor({
  open,
  onClose,
  eventId,
  hostToken,
  eventName,
  guestUrl,
  theme,
  badge,
  saved,
  onSaved,
  onPrint,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  hostToken?: string;
  eventName: string;
  guestUrl: string;
  theme: string;
  badge: boolean;
  /** The host's saved text, or null for the defaults. */
  saved: CardText | null;
  onSaved: (text: CardText | null) => void;
  /** Prints the tent with this text. */
  onPrint: (text: CardText) => void;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState(saved !== null);
  const [draft, setDraft] = useState<CardText>(saved ?? DEFAULT_CARD_TEXT);
  const [busy, setBusy] = useState<"save" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = custom ? cardTextFor(draft) : DEFAULT_CARD_TEXT;

  // The preview is the real printed face, scaled to fit the sheet.
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / (FACE_W_MM * PX_PER_MM)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  /** Saves when something changed; returns the text to use, or null on error. */
  async function commit(): Promise<CardText | null | false> {
    const checked = validateCardText(custom ? draft : null);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const next = checked.value;
    const changed = JSON.stringify(next) !== JSON.stringify(saved);
    if (changed && hostToken) {
      const r = await saveCardText(eventId, hostToken, next);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      router.refresh();
    }
    if (changed) onSaved(next);
    return next;
  }

  async function save() {
    setError(null);
    setBusy("save");
    const r = await commit();
    setBusy(null);
    if (r !== false) onClose();
  }

  async function print() {
    setError(null);
    setBusy("print");
    const r = await commit();
    setBusy(null);
    if (r === false) return;
    onClose();
    onPrint(cardTextFor(r));
  }

  const footer = (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-[12px] bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-base font-semibold transition-colors hover:bg-surface-3 disabled:opacity-60"
        >
          {busy === "save" && <Spinner />}
          Save
        </button>
        <button
          type="button"
          onClick={print}
          disabled={busy !== null}
          className="flex h-[54px] flex-[2] items-center justify-center gap-2 rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy === "print" ? <Spinner /> : <PrinterIcon size={18} />}
          Print
        </button>
      </div>
      <span className="text-center text-[12.5px] text-ink-3">A4 · fold along the dashed line and stand it on the table</span>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Table card" footer={footer}>
      <div className="flex flex-col gap-5">
        <div
          ref={frameRef}
          data-theme={theme}
          className="w-full overflow-hidden rounded-[18px] border border-line bg-white shadow-1"
          style={{ height: FACE_H_MM * PX_PER_MM * scale }}
          aria-label="Preview of the printed card"
          role="img"
        >
          <div
            className="flex"
            style={{
              width: `${FACE_W_MM}mm`,
              height: `${FACE_H_MM}mm`,
              padding: "9mm",
              background: "#fff",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <TentFace eventName={eventName} guestUrl={guestUrl} badge={badge} text={shown} />
          </div>
        </div>

        <div role="radiogroup" aria-label="Card text" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {[
            { on: !custom, label: "Default text", set: false },
            { on: custom, label: "Custom text", set: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={o.on}
              onClick={() => {
                setCustom(o.set);
                setError(null);
              }}
              className={`h-11 rounded-full text-[15px] font-semibold transition-colors ${o.on ? "bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {custom ? (
          <div className="flex flex-col gap-3.5">
            {(Object.keys(CARD_TEXT_LABELS) as (keyof CardText)[]).map((key) => {
              const value = draft[key];
              const over = value.length > CARD_TEXT_LIMITS[key];
              return (
                <label key={key} className="flex flex-col gap-[7px]">
                  <span className="flex justify-between text-sm font-medium">
                    <span>{CARD_TEXT_LABELS[key]}</span>
                    <span className={`tabular-nums ${over ? "text-danger" : "text-ink-3"}`}>
                      {value.length}/{CARD_TEXT_LIMITS[key]}
                    </span>
                  </span>
                  {key === "message" ? (
                    <textarea
                      rows={2}
                      value={value}
                      placeholder={DEFAULT_CARD_TEXT[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className={`${FIELD} h-auto resize-none py-3 leading-snug`}
                    />
                  ) : (
                    <input
                      value={value}
                      placeholder={DEFAULT_CARD_TEXT[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className={FIELD}
                    />
                  )}
                </label>
              );
            })}
            <p className="text-[12.5px] leading-normal text-ink-3">
              The event name, QR code and the three steps stay the same. Leave a line empty to use the default.
            </p>
          </div>
        ) : (
          <p className="text-[13px] leading-normal text-ink-3">
            The standard wording. Switch to Custom text to write your own welcome, like “Welcome to our wedding! Share your favourite
            moments.”
          </p>
        )}
      </div>
    </Sheet>
  );
}
