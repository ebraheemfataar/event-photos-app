// Presentation-only helpers (colours, handles, relative times). No data access.

/** Photo-placeholder palette from the V3 design boards. */
export const SWATCHES = {
  or: { bg: "#FF5A1F", ink: "#0E0E10" },
  bl: { bg: "#2B2BFF", ink: "#FFFFFF" },
  gr: { bg: "#1E7A4C", ink: "#FFFFFF" },
  ye: { bg: "#FFC21A", ink: "#0E0E10" },
  pk: { bg: "#FF8FB1", ink: "#0E0E10" },
  bk: { bg: "#1B1B1D", ink: "#F4F4F2" },
  sk: { bg: "#9CC9FF", ink: "#0E0E10" },
  cr: { bg: "#E9DDCB", ink: "#0E0E10" },
  li: { bg: "#C9F25B", ink: "#0E0E10" },
  pu: { bg: "#7B4BFF", ink: "#FFFFFF" },
} as const;

export type Swatch = (typeof SWATCHES)[keyof typeof SWATCHES];

const PROMPT_SWATCH: Record<string, keyof typeof SWATCHES> = {
  "with-the-host": "pk",
  "dance-floor": "or",
  "made-you-laugh": "ye",
  cheers: "cr",
  "best-dressed": "sk",
  "with-friends": "li",
  "live-music": "bl",
  candid: "bk",
  "decor-detail": "gr",
  "see-you-soon": "pu",
  "group-photo": "or",
};

/** Short labels for the 62px highlight circles. */
const PROMPT_SHORT: Record<string, string> = {
  "with-the-host": "Host",
  "dance-floor": "Dance",
  "made-you-laugh": "Laughs",
  cheers: "Cheers",
  "best-dressed": "Style",
  "with-friends": "Selfies",
  "live-music": "Music",
  candid: "Candid",
  "decor-detail": "Decor",
  "see-you-soon": "Goodbyes",
  "group-photo": "Group",
};

export function promptSwatch(id: string): Swatch {
  return SWATCHES[PROMPT_SWATCH[id] ?? "or"];
}

export function promptShortLabel(id: string, fallback: string): string {
  return PROMPT_SHORT[id] ?? fallback;
}

const AVATAR_ORDER: (keyof typeof SWATCHES)[] = ["or", "bl", "ye", "pk", "gr", "sk", "li", "pu", "cr"];

/** Stable colour per guest name, for initial avatars. */
export function avatarSwatch(name: string | null): Swatch {
  if (!name) return SWATCHES.bk;
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SWATCHES[AVATAR_ORDER[h % AVATAR_ORDER.length]];
}

export function initialOf(name: string | null): string {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

/** "Sam & Alex's Wedding" → "sam-and-alexs-wedding" */
export function eventHandle(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "album";
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
