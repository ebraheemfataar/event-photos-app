import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { cleanUrl, monogram, validateDetails } from "../lib/eventDetails";
import { cardTextFor, validateCardText, DEFAULT_CARD_TEXT } from "../lib/cardText";
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

test("event type: known ids only; empty means not set", () => {
  const typed = validateDetails({ ...valid, eventType: "wedding" });
  expect(typed.ok && typed.value.event_type).toBe("wedding");
  const unset = validateDetails(valid);
  expect(unset.ok && unset.value.event_type).toBeNull();
  expect(validateDetails({ ...valid, eventType: "rave" }).ok).toBe(false);
});

test("table card text: trimmed, limited, blanks fall back to the defaults", () => {
  expect(validateCardText(null)).toEqual({ ok: true, value: null });
  expect(validateCardText({ eyebrow: " ", message: "", pill: "" })).toEqual({ ok: true, value: null });
  const r = validateCardText({ eyebrow: "  Welcome  ", message: "Share  your\nfavourite moments", pill: "" });
  expect(r).toEqual({ ok: true, value: { eyebrow: "Welcome", message: "Share your favourite moments", pill: "" } });
  expect(validateCardText({ eyebrow: "x".repeat(41) }).ok).toBe(false);
  expect(validateCardText({ message: "x".repeat(121) }).ok).toBe(false);
  expect(validateCardText("hello").ok).toBe(false);
  expect(cardTextFor({ eyebrow: "Welcome", message: "", pill: "" })).toEqual({ ...DEFAULT_CARD_TEXT, eyebrow: "Welcome" });
  expect(cardTextFor(null)).toEqual(DEFAULT_CARD_TEXT);
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

  test("create form saves type, theme, date and note; the type is required", async ({ page }) => {
    await phone(page);
    await page.goto(`${BASE}/#create`);
    const name = `Create test ${Date.now()}`;
    await page.getByPlaceholder("Sam & Alex's Wedding").fill(name);
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Pick what kind of event it is.")).toBeVisible();
    await page.getByRole("radio", { name: /Wedding/ }).click();
    await expect(page.getByText("Pick what kind of event it is.")).toHaveCount(0);
    await page.locator('input[type="date"]').fill("2026-12-05");
    await page.getByPlaceholder("Snap the speeches and the dance floor.").fill("Dress code: sparkle");
    await page.getByRole("radio", { name: /Champagne/ }).click();
    await page.getByRole("button", { name: "Create event" }).click();
    await page.waitForURL(/\/host\/.+\?t=/);
    await expect(page.locator("[data-theme]").first()).toHaveAttribute("data-theme", "gold");

    const id = new URL(page.url()).pathname.split("/").pop();
    const { url, serviceKey } = localEnv();
    const { data } = await createClient(url, serviceKey).from("events").select("event_type").eq("id", id!).single();
    expect(data!.event_type).toBe("wedding");
    await page.goto(`${BASE}/e/${id}`);
    await expect(page.getByText("Dress code: sparkle").first()).toBeVisible();
    await expect(page.getByText(/5 December 2026/).first()).toBeVisible();
  });

  test("host changes the event type in Edit event", async ({ page }) => {
    await phone(page);
    const ev = await newEvent(`Type edit ${Date.now()}`);
    await page.goto(ev.hostUrl);
    await page.getByRole("button", { name: "Edit event" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Edit event" });
    await sheet.getByRole("radio", { name: /Corporate/ }).click();
    await sheet.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Event details saved")).toBeVisible();
    const { url, serviceKey } = localEnv();
    const { data } = await createClient(url, serviceKey).from("events").select("event_type").eq("id", ev.id).single();
    expect(data!.event_type).toBe("corporate");
  });

  test("table card: preview, custom text saved with the album and printed; guests can't edit it", async ({ page }) => {
    await phone(page);
    const ev = await newEvent(`Card text ${Date.now()}`);
    await page.goto(ev.hostUrl);
    await page.locator("#invite").getByRole("button", { name: /Print table card/ }).click();
    const sheet = page.getByRole("dialog", { name: "Table card" });
    const preview = sheet.getByRole("img", { name: "Preview of the printed card" });
    await expect(preview).toContainText("Every angle of the party");

    await sheet.getByRole("radio", { name: "Custom text" }).click();
    await sheet.getByLabel("Line above the name").fill("Welcome to our wedding");
    await sheet.getByLabel("Message").fill("Share your favourite moments with us!");
    await expect(preview).toContainText("Share your favourite moments with us!");
    await expect(preview).toContainText("No app · No login · Just scan");
    await sheet.getByLabel("Line above the name").fill("x".repeat(41));
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet.getByRole("alert")).toContainText("under 40 characters");
    await sheet.getByLabel("Line above the name").fill("Welcome to our wedding");
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Card text saved")).toBeVisible();

    const { url, serviceKey } = localEnv();
    const db = createClient(url, serviceKey);
    const { data } = await db.from("events").select("card_text").eq("id", ev.id).single();
    expect(data!.card_text).toEqual({ eyebrow: "Welcome to our wedding", message: "Share your favourite moments with us!", pill: "No app · No login · Just scan" });

    // The small card on the page uses it too, and it survives a reload.
    await page.reload();
    await expect(page.locator("#invite").getByText("Welcome to our wedding")).toBeVisible();

    // Print: the tent is built with the custom text (window.print stubbed).
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator("#invite").getByRole("button", { name: /Print table card/ }).click();
    await page.getByRole("dialog", { name: "Table card" }).getByRole("button", { name: "Print" }).click();
    await expect(page.locator(".print-root .tent-sub").first()).toHaveText("Share your favourite moments with us!");

    // Back to the defaults.
    await page.locator("#invite").getByRole("button", { name: /Print table card/ }).click();
    const again = page.getByRole("dialog", { name: "Table card" });
    await again.getByRole("radio", { name: "Default text" }).click();
    await again.getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => (await db.from("events").select("card_text").eq("id", ev.id).single()).data!.card_text).toBeNull();

    // Guests print straight away, with no editor.
    await page.goto(ev.guestUrl);
    await expect(page.getByRole("dialog", { name: "Table card" })).toHaveCount(0);
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

  test("Edit event: tap cover / poster to view them full size; images survive an optimiser failure", async ({ page }) => {
    const ev = await newEvent(`Viewer test ${Date.now()}`);
    const { url, serviceKey } = localEnv();
    const service = createClient(url, serviceKey);
    const jpeg = await makeJpeg(page, "#884422");
    const cover = `${ev.id}/_event/cover-${randomUUID()}.jpg`;
    const poster = `${ev.id}/_event/poster-${randomUUID()}.jpg`;
    for (const p of [cover, poster]) await service.storage.from("event-photos").upload(p, jpeg, { contentType: "image/jpeg" });
    await service.from("events").update({ cover_path: cover, poster_path: poster }).eq("id", ev.id);

    // Break Next's image optimiser: covers must still show (original file).
    await page.route("**/_next/image**", (r) => r.fulfill({ status: 500, body: "broken" }));
    await phone(page);
    await page.goto(ev.hostUrl);
    const circle = page.locator('button[aria-label^="About"] img').first();
    await expect.poll(() => circle.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 10_000 }).toBe(true);
    expect(await circle.getAttribute("src")).toContain("/media/");

    await page.getByRole("button", { name: "Edit event", exact: true }).first().click();
    const sheet = page.getByRole("dialog", { name: "Edit event" });
    await sheet.getByRole("button", { name: "View cover full size" }).click();
    const viewer = page.getByRole("dialog", { name: "Cover photo" });
    await expect(viewer.getByRole("img", { name: "Cover photo" })).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Open original ↗" })).toHaveAttribute("href", new RegExp(`/media/${ev.id}/cover/`));
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(sheet, "Esc closes only the viewer").toBeVisible();

    await sheet.getByRole("button", { name: "View poster full size" }).click();
    await expect(page.getByRole("dialog", { name: "Poster" }).getByRole("img", { name: "Poster" })).toBeVisible();
    await page.getByRole("dialog", { name: "Poster" }).getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeVisible();
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
