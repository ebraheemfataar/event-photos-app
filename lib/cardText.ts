// Wording on the printed table card (TableTent). A host can replace three
// lines; the event name, QR code and the 1-2-3 steps always stay. Shared by
// the browser (live preview) and the server (saveCardText re-validates);
// stored as `events.card_text` (0016), null = the defaults.

export type CardText = { eyebrow: string; message: string; pill: string };

export const DEFAULT_CARD_TEXT: CardText = {
  eyebrow: "Scan to add your photos",
  message: "Every angle of the party, in one shared album.",
  pill: "No app · No login · Just scan",
};

export const CARD_TEXT_LIMITS: Record<keyof CardText, number> = {
  eyebrow: 40,
  message: 120,
  pill: 40,
};

export const CARD_TEXT_LABELS: Record<keyof CardText, string> = {
  eyebrow: "Line above the name",
  message: "Message",
  pill: "Small print",
};

/** The wording to print: the saved custom text, else the defaults. Blank
 * fields fall back to their default line. */
export function cardTextFor(saved: Partial<CardText> | null | undefined): CardText {
  return {
    eyebrow: saved?.eyebrow?.trim() || DEFAULT_CARD_TEXT.eyebrow,
    message: saved?.message?.trim() || DEFAULT_CARD_TEXT.message,
    pill: saved?.pill?.trim() || DEFAULT_CARD_TEXT.pill,
  };
}

/** Cleans custom text for saving: trimmed, single line, within limits.
 * Returns null for "use the defaults" (nothing custom left). */
export function validateCardText(
  input: unknown
): { ok: true; value: CardText | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "object") return { ok: false, error: "That card text doesn't look right." };
  const raw = input as Record<string, unknown>;
  const out = { eyebrow: "", message: "", pill: "" } as CardText;
  for (const key of Object.keys(out) as (keyof CardText)[]) {
    const v = String(raw[key] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (v.length > CARD_TEXT_LIMITS[key]) {
      return { ok: false, error: `Keep “${CARD_TEXT_LABELS[key]}” under ${CARD_TEXT_LIMITS[key]} characters.` };
    }
    out[key] = v;
  }
  if (!out.eyebrow && !out.message && !out.pill) return { ok: true, value: null };
  return { ok: true, value: out };
}
