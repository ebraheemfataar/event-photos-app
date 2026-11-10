// Event themes (docs/ROADMAP.md → Event themes). A theme only changes the
// album's frame — colours, heading font, cover ring, QR table card — never
// the photos. The palettes live in app/globals.css as
// `[data-theme="<id>"]` / `.dark [data-theme="<id>"]` blocks; every one is
// contrast-checked by tests/themes.spec.ts.

export const THEMES = [
  { id: "classic", name: "Classic", hint: "Ink, paper and one orange accent", swatches: ["#F4F4F2", "#0E0E10", "#FF5A1F"] },
  { id: "gold", name: "Gold & ivory", hint: "Warm ivory, soft gold, serif headings", swatches: ["#FBF8F2", "#2A2117", "#B8955E"] },
  { id: "blush", name: "Blush", hint: "Soft pink and cream, serif headings", swatches: ["#FBF3F1", "#2E1B20", "#E59AA4"] },
  { id: "midnight", name: "Midnight", hint: "Deep navy with champagne", swatches: ["#0A0E1F", "#E9D6A8", "#D9B979"] },
  { id: "garden", name: "Garden", hint: "Sage green and white", swatches: ["#F3F6F0", "#1F3A2B", "#8DB580"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "classic";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function themeName(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.name ?? "Classic";
}
