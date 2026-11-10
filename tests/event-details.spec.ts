import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { cleanUrl, monogram, validateDetails } from "../lib/eventDetails";
import { BASE, localEnv, makeJpeg } from "./helpers";

// Event details (0008): cover, poster, date, note, links, theme.

const valid = { name: "Party", theme: "classic", eventDate: "", note: "", links: [] };

test("links: only https web addresses get through", () => {
  expect(cleanUrl("example.com/registry")).toBe("https://example.com/registry");
  expect(cleanUrl("https://example.com")).toBe("https://example.com/");
  for (const bad of ["javascript:alert(1)", "http://example.com", "data:text/html,hi", "https://user:pw@example.com", "localhost", "ftp://x.com", ""]) {
    expect(cleanUrl(bad), bad).toBeNull();
  }
});

test("validateDetails: limits and errors", () => {
  expect(validateDetails(valid).ok).toBe(true);
  expect(validateDetails({ ...valid, name: "  " }).ok).toBe(false);
  expect(validateDetails({ ...valid, theme: "neon" }).ok).toBe(false);
  expect(validateDetails({ ...valid, eventDate: "2026-02-30" }).ok).toBe(false);
  expect(validateDetails({ ...valid, note: "x".repeat(281) }).ok).toBe(false);
  const five = Array.from({ length: 5 }, (_, i) => ({ label: `L${i}`, url: "example.com" }));
  expect(validateDetails({ ...valid, links: five }).ok).toBe(false);
  expect(validateDetails({ ...valid, links: [{ label: "Bad", url: "javascript:alert(1)" }] }).ok).toBe(false);
  // Empty rows are dropped, not errors.
  const r = validateDetails({ ...valid, links: [{ label: "", url: "" }, { label: "Registry", url: "example.com" }] });
  expect(r.ok && r.value.links).toEqual([{ label: "Registry", url: "https://example.com/" }]);
});

test("monogram", () => {
  expect(monogram("Sam & Alex's Wedding")).toBe("S&A");
  expect(monogram("Gala")).toBe("G");
});

// ---- End-to-end (local stack + dev server, E2E_BASE_URL set) ----

test.describe("end-to-end", () => {
  test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

  /** A fresh event per test, so tests never fight over the seed event. */
  async function newEvent(name: string) {
    const { url, anonKey } = localEnv();
    const { data, error } = await createClient(url, anonKey).rpc("create_event", { p_name: name });
    expect(error).toBeNull();
    const row = (data as { id: string; host_token: string }[])[0];
    return { id: row.id, hostUrl: `${BASE}/host/${row.id}?t=${row.host_token}`, guestUrl: `${BASE}/e/${row.id}` };
  }

  async function phone(page: Page) {
    await page.setViewportSize({ width: 390, height: 844 });
  }

  test("create form saves theme, date and note", async ({ page }) => {
    await phone(page);
    await page.goto(`${BASE}/#create`);
    const name = `Create test ${Date.now()}`;
    await page.getByPlaceholder("Sam & Alex's Wedding").fill(name);
    await page.locator('input[type="date"]').fill("2026-12-05");
    await page.getByPlaceholder("Snap the speeches and the dance floor.").fill("Dress code: sparkle");
    await page.getByRole("radio", { name: /Champagne/ }).click();
    await page.getByRole("button", { name: "Create event" }).click();
    await page.waitForURL(/\/host\/.+\?t=/);
    await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "gold");

    const id = new URL(page.url()).pathname.split("/").pop();
    await page.goto(`${BASE}/e/${id}`);
    await expect(page.getByText("Dress code: sparkle").first()).toBeVisible();
    await expect(page.getByText(/5 December 2026/).first()).toBeVisible();
  });

  test("host edits details; guests see them; bad links are refused", async ({ browser }) => {
    const ev = await newEvent(`Edit test ${Date.now()}`);
    const host = await (await browser.newContext()).newPage();
    await phone(host);
    await host.goto(ev.hostUrl);

    await host.getByRole("button", { name: "Edit event" }).first().click();
    const sheet = host.getByRole("dialog", { name: "Edit event" });
    await sheet.getByLabel("Event name").fill("Mia's 30th");
    await sheet.getByLabel(/Note for guests/).fill("Rooftop from 7pm");
    await sheet.getByRole("button", { name: "Add a link" }).click();
    await sheet.getByLabel("Link 1 label").fill("Playlist");

    for (const bad of ["javascript:alert(1)", "http://example.com"]) {
      await sheet.getByLabel("Link 1 address").fill(bad);
      await sheet.getByRole("button", { name: "Save details" }).click();
      await expect(sheet.getByRole("alert")).toContainText("needs a web address starting with https://");
    }

    await sheet.getByLabel("Link 1 address").fill("example.com/playlist");
    await sheet.getByRole("radio", { name: /Rosé/ }).click();
    await sheet.getByRole("button", { name: "Save details" }).click();
    await expect(host.getByText("Event details saved")).toBeVisible();
    await expect(host.locator("[data-theme]").first()).toHaveAttribute("data-theme", "blush");

    const guest = await (await browser.newContext()).newPage();
    await phone(guest);
    await guest.goto(ev.guestUrl);
    await expect(guest.locator("[data-theme]").first()).toHaveAttribute("data-theme", "blush");
    await expect(guest.getByText(/Rooftop from 7pm/).first()).toBeVisible();
    await guest.getByRole("button", { name: "About Mia's 30th" }).first().click();
    const info = guest.getByRole("dialog", { name: "Event info" });
    await expect(info.getByRole("link", { name: /Playlist/ })).toHaveAttribute("href", "https://example.com/playlist");
    await expect(info.getByRole("button", { name: /Edit/ }), "guests can't edit").toHaveCount(0);
  });

  test("cover: crop, upload, served from /media, old file removed", async ({ page }) => {
    const ev = await newEvent(`Cover test ${Date.now()}`);
    await phone(page);
    await page.goto(ev.hostUrl);
    const jpeg = await makeJpeg(page, "#2F7D5B");

    const coverPath = async () => {
      const img = page.locator(`button[aria-label^="About"] img`).first();
      if (!(await img.count())) return undefined;
      return decodeURIComponent((await img.getAttribute("src")) ?? "").match(/\/media\/[^&?]+/)?.[0];
    };

    async function uploadCover(previous?: string) {
      await page.getByRole("button", { name: "Edit event", exact: true }).first().click();
      const edit = page.getByRole("dialog", { name: "Edit event" });
      await edit.getByLabel("Choose cover image").setInputFiles({ name: "c.jpg", mimeType: "image/jpeg", buffer: jpeg });
      await expect(edit.getByRole("img", { name: "Cover crop preview" })).toBeVisible();
      await edit.getByLabel("Zoom").fill("2");
      await edit.getByRole("button", { name: "Use this" }).click();
      await expect(page.getByText("Cover updated")).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press("Escape");
      await expect.poll(coverPath, { timeout: 15_000 }).not.toBe(previous);
      const path = await coverPath();
      expect(path, "cover served by /media").toContain(`/media/${ev.id}/cover/`);
      return path!;
    }

    const first = await uploadCover();
    const res = await page.request.get(`${BASE}${first}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^image\//);

    const second = await uploadCover(first);
    expect(second).not.toBe(first);
    expect((await page.request.get(`${BASE}${first}`)).status(), "old cover is gone").toBe(404);
    expect((await page.request.get(`${BASE}${second}`)).status()).toBe(200);
  });

  test("guests and wrong tokens get no edit controls; no cover shows the monogram", async ({ page }) => {
    const ev = await newEvent("Jo & Kim's Party");
    await phone(page);
    for (const url of [ev.guestUrl, `${BASE}/host/${ev.id}?t=${randomUUID()}`]) {
      await page.goto(url);
      await expect(page.getByRole("button", { name: "About Jo & Kim's Party" }).first()).toContainText("J&K");
      await expect(page.getByRole("button", { name: "Edit event" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Add cover" })).toHaveCount(0);
    }
  });

  test("demo host can edit details on the page only", async ({ page }) => {
    await phone(page);
    await page.goto(`${BASE}/demo?as=host`);
    await page.getByRole("button", { name: "Edit event" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Edit event" });
    await expect(sheet.getByText(/this page only/)).toBeVisible();
    await sheet.getByLabel("Event name").fill("Demo rename");
    await sheet.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved on this page only (demo)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Demo rename" })).toBeVisible();
  });
});
