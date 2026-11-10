import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { THEMES } from "../lib/themes";

// Every theme, light and dark, must keep text readable (WCAG contrast).
// Reads the palettes straight from app/globals.css, so a colour tweak there
// is checked automatically. No browser needed.

const css = fs.readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  const vars: Record<string, string> = {};
  if (!match) return vars;
  for (const m of match[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

/** Effective palette, following the cascade in globals.css. */
function palette(themeId: string, dark: boolean): Record<string, string> {
  const root = block(':root, [data-theme="classic"]');
  const rootDark = dark ? block('.dark, .dark [data-theme="classic"]') : {};
  if (themeId === "classic") return { ...root, ...rootDark };
  return {
    ...root,
    ...rootDark,
    ...block(`[data-theme="${themeId}"]`),
    ...(dark ? block(`.dark [data-theme="${themeId}"]`) : {}),
  };
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [foreground, background, minimum ratio, what it is]
const PAIRS: [string, string, number, string][] = [
  ["ink", "bg", 7, "body text"],
  ["ink", "surface", 7, "text on cards"],
  ["ink-2", "bg", 4.5, "secondary text"],
  ["ink-2", "surface", 4.5, "secondary text on cards"],
  ["ink-3", "bg", 4.5, "small labels"],
  ["ink-3", "surface", 4.5, "small labels on cards"],
  ["ink-3", "surface-2", 4.5, "input placeholders"],
  ["mute", "bg", 2.6, "large headline second half (decorative)"],
  ["btn-ink", "btn", 4.5, "primary button text"],
  ["accent-ink", "accent", 4.5, "icon / text on accent circles"],
  ["card-ink", "card-bg", 7, "QR card event name"],
  ["card-muted", "card-bg", 4.5, "QR card label"],
  ["card-strip-ink", "card-strip", 4.5, "QR card strip text"],
];

for (const theme of THEMES) {
  for (const dark of [false, true]) {
    test(`${theme.name} (${dark ? "dark" : "light"}) has readable contrast`, () => {
      const p = palette(theme.id, dark);
      const failures: string[] = [];
      for (const [fg, bg, min, what] of PAIRS) {
        expect(p[fg], `--${fg} defined`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(p[bg], `--${bg} defined`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        const ratio = contrast(p[fg], p[bg]);
        if (ratio < min) failures.push(`${what}: --${fg} on --${bg} = ${ratio.toFixed(2)} (needs ${min})`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  }
}

test("demo theme preview: ?theme= applies, picker switches and updates the URL", async ({ page }) => {
  const base = process.env.E2E_BASE_URL;
  test.skip(!base, "set E2E_BASE_URL to run end-to-end tests");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/demo?theme=gold`);
  const album = page.locator("[data-theme]").first();
  await expect(album).toHaveAttribute("data-theme", "gold");

  await page.getByRole("button", { name: /Change theme/ }).click();
  await page.getByRole("radio", { name: /Midnight/ }).click();
  await expect(album).toHaveAttribute("data-theme", "midnight");
  await expect(page).toHaveURL(/theme=midnight/);

  await page.getByRole("radio", { name: /Sunset Pop/ }).click();
  await expect(album).toHaveAttribute("data-theme", "classic");
  await expect(page).not.toHaveURL(/theme=/);

  // Junk values fall back to Classic.
  await page.goto(`${base}/demo?theme=<script>`);
  await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "classic");
});

test("every theme in lib/themes.ts has CSS (except Classic, which is the default)", () => {
  for (const t of THEMES) {
    if (t.id === "classic") continue;
    expect(Object.keys(block(`[data-theme="${t.id}"]`)).length, `${t.id} light block`).toBeGreaterThan(10);
    expect(Object.keys(block(`.dark [data-theme="${t.id}"]`)).length, `${t.id} dark block`).toBeGreaterThan(10);
  }
});
