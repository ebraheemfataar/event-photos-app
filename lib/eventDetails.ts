// Event details shared by the browser and the server: validation rules,
// monogram initials, image URLs. The server re-runs `validateDetails` before
// every write (lib/eventActions.ts); the DB has CHECK constraints as a
// backstop (0008_event_details.sql).

import type { Event, EventLink } from "@/lib/types";
import { isThemeId, type ThemeId } from "@/lib/themes";

export const LIMITS = { name: 100, note: 280, links: 4, linkLabel: 40, linkUrl: 500 } as const;

export type EventImageKind = "cover" | "poster";

export type DetailsInput = {
  name: string;
  theme: string;
  eventDate: string; // "" or YYYY-MM-DD
  note: string;
  links: { label: string; url: string }[];
};

export type ValidDetails = {
  name: string;
  theme: ThemeId;
  event_date: string | null;
  note: string | null;
  links: EventLink[];
};

/** Only real https:// web addresses. Blocks javascript:, data:, http:, etc. */
export function cleanUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > LIMITS.linkUrl) return null;
  // Let hosts paste "example.com/registry"; we add https:// for them.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Returns cleaned details, or a guest-readable error message. */
export function validateDetails(input: DetailsInput): { ok: true; value: ValidDetails } | { ok: false; error: string } {
  const name = String(input?.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the event a name." };
  if (name.length > LIMITS.name) return { ok: false, error: `Keep the name under ${LIMITS.name} characters.` };

  if (!isThemeId(input.theme)) return { ok: false, error: "Pick one of the themes." };

  const rawDate = String(input.eventDate ?? "").trim();
  let event_date: string | null = null;
  if (rawDate) {
    const d = new Date(`${rawDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== rawDate) {
      return { ok: false, error: "That date doesn't look right." };
    }
    event_date = rawDate;
  }

  const note = String(input.note ?? "").trim();
  if (note.length > LIMITS.note) return { ok: false, error: `Keep the note under ${LIMITS.note} characters.` };

  const rows = Array.isArray(input.links) ? input.links : [];
  const filled = rows.filter((l) => String(l?.label ?? "").trim() || String(l?.url ?? "").trim());
  if (filled.length > LIMITS.links) return { ok: false, error: `Up to ${LIMITS.links} links.` };
  const links: EventLink[] = [];
  for (const row of filled) {
    const label = String(row.label ?? "").trim();
    const url = cleanUrl(String(row.url ?? ""));
    if (!label) return { ok: false, error: "Every link needs a label, like “Gift registry”." };
    if (label.length > LIMITS.linkLabel) return { ok: false, error: `Keep link labels under ${LIMITS.linkLabel} characters.` };
    if (!url) return { ok: false, error: `“${label}” needs a web address starting with https://` };
    links.push({ label, url });
  }

  return { ok: true, value: { name, theme: input.theme, event_date, note: note || null, links } };
}

/** "Sam & Alex's Wedding" → "S&A", "Mia's 30th" → "M3", "Gala" → "G". */
export function monogram(name: string): string {
  const words = name
    .replace(/['’]s\b/gi, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}&]/gu, ""))
    .filter(Boolean);
  const amp = words.findIndex((w) => w === "&" || w.toLowerCase() === "and");
  if (amp > 0 && words[amp + 1]) {
    return `${words[amp - 1][0]}&${words[amp + 1][0]}`.toUpperCase();
  }
  const letters = words.filter((w) => w !== "&").slice(0, 2).map((w) => w[0]);
  return (letters.join("") || "?").toUpperCase();
}

export function formatEventDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** URL for an event's cover or poster (served from the private bucket by
 * app/media/[eventId]/[kind]/[file]/route.ts). The file name is unique per
 * upload, so a replaced image gets a new URL. Demo rows hold https URLs. */
export function eventImageSrc(event: Pick<Event, "id" | "cover_path" | "poster_path">, kind: EventImageKind): string | null {
  const path = kind === "cover" ? event.cover_path : event.poster_path;
  if (!path) return null;
  if (path.startsWith("https://")) return path;
  const file = path.split("/").pop();
  return file ? `/media/${event.id}/${kind}/${file}` : null;
}
