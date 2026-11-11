import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { GUEST_UPLOADS_PER_HOUR, sniffImageType, typesMatch } from "../lib/uploadRules";
import { BASE, SEED_EVENT, SEED_HOST_TOKEN, guestHash, localEnv, makeJpeg, waitForAlbumSubscription } from "./helpers";

// Phase 2c (0009 / 0010, lib/uploadActions.ts): uploads only through the
// server, content-checked, rate-limited; guests delete their own photos.

test("sniffImageType: real bytes decide the type", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  const text = (s: string) => new TextEncoder().encode(s);
  expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  expect(sniffImageType(text("GIF89a......"))).toBe("image/gif");
  expect(sniffImageType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  expect(sniffImageType(text("\0\0\0\x18ftypheic"))).toBe("image/heic");
  expect(sniffImageType(text("<html><script>"))).toBeNull();
  expect(sniffImageType(text("%PDF-1.7"))).toBeNull();
  expect(typesMatch("image/heif", "image/heic")).toBe(true);
  expect(typesMatch("image/jpeg", "image/png")).toBe(false);
});

test.describe("end-to-end", () => {
  test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

  const GUEST_URL = `${BASE}/e/${SEED_EVENT}`;
  const tile = (page: Page, id: string) => page.locator(`[data-photo-id="${id}"]`);

  /** A page whose browser uses a known guest id. */
  async function guestPage(page: Page, guestId: string, url = GUEST_URL) {
    await page.addInitScript((id) => localStorage.setItem("snap-guest-id", id), guestId);
    const subscribed = waitForAlbumSubscription(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await subscribed;
  }

  async function pickFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, name?: string) {
    await page.getByRole("button", { name: "Add photos" }).first().click();
    if (name) await page.getByPlaceholder("optional").fill(name);
    await page.locator('input[type="file"][multiple]').setInputFiles(file);
    await page.getByRole("button", { name: "Share photo" }).click();
  }

  const service = () => {
    const { url, serviceKey } = localEnv();
    return createClient(url, serviceKey);
  };

  /** Pretend this guest already started `n` uploads in the last hour. */
  async function fillTickets(guestId: string, n: number) {
    const rows = Array.from({ length: n }, () => {
      const id = randomUUID();
      return {
        photo_id: id,
        event_id: SEED_EVENT,
        storage_path: `${SEED_EVENT}/${id}.jpg`,
        content_type: "image/jpeg",
        guest_hash: guestHash(guestId),
        ip_hash: "test",
        finished_at: new Date().toISOString(),
      };
    });
    const { error } = await service().from("upload_tickets").insert(rows);
    expect(error).toBeNull();
  }

  test("anon can no longer upload or insert directly", async ({ page }) => {
    const { url, anonKey } = localEnv();
    const anon = createClient(url, anonKey);
    const id = randomUUID();
    const up = await anon.storage
      .from("event-photos")
      .upload(`${SEED_EVENT}/${id}.jpg`, await makeJpeg(page), { contentType: "image/jpeg" });
    expect(up.error, "direct storage upload refused").not.toBeNull();
    const ins = await anon.from("photos").insert({ id, event_id: SEED_EVENT, storage_path: `${SEED_EVENT}/${id}.jpg` });
    expect(ins.error, "direct photos insert refused").not.toBeNull();
  });

  test("a file that isn't really an image is refused and removed", async ({ page }) => {
    await guestPage(page, randomUUID());
    // GIFs skip compression, so this reaches the server as-is.
    await pickFile(page, { name: "evil.gif", mimeType: "image/gif", buffer: Buffer.from("<html><script>alert(1)</script>") });
    await expect(page.getByText("That file isn't a photo we can share.")).toBeVisible({ timeout: 20_000 });

    const { data } = await service().storage.from("event-photos").list(SEED_EVENT, { limit: 1000 });
    const { data: tickets } = await service()
      .from("upload_tickets")
      .select("storage_path")
      .eq("content_type", "image/gif")
      .order("created_at", { ascending: false })
      .limit(1);
    const file = tickets?.[0]?.storage_path.split("/").pop();
    expect(data?.some((o) => o.name === file), "rejected file deleted from storage").toBe(false);
  });

  test(`a guest is cut off after ${GUEST_UPLOADS_PER_HOUR} uploads an hour`, async ({ page }) => {
    const guestId = randomUUID();
    await fillTickets(guestId, GUEST_UPLOADS_PER_HOUR);
    await guestPage(page, guestId);
    await pickFile(page, { name: "one-more.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page) });
    await expect(page.getByText(/shared a lot in the last hour/)).toBeVisible({ timeout: 20_000 });
  });

  test("the host isn't rate-limited, and their uploads are marked as the host's", async ({ page }) => {
    const guestId = randomUUID();
    await fillTickets(guestId, GUEST_UPLOADS_PER_HOUR);
    await guestPage(page, guestId, `${BASE}/host/${SEED_EVENT}?t=${SEED_HOST_TOKEN}`);
    const name = `Host limit ${Date.now()}`;
    await pickFile(page, { name: "host.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, "#123456") }, name);
    await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 20_000 });
    const { data } = await service().from("photos").select("by_host, guest_hash").eq("guest_name", name).single();
    expect(data).toEqual({ by_host: true, guest_hash: guestHash(guestId) });
  });

  test("guests delete their own photo, and only their own", async ({ browser }) => {
    const me = await (await browser.newContext()).newPage();
    const other = await (await browser.newContext()).newPage();
    await guestPage(me, randomUUID());
    await guestPage(other, randomUUID());

    const name = `Mine ${Date.now()}`;
    await pickFile(me, { name: "mine.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(me, "#AA3377") }, name);
    await expect(me.getByText("Shared to the album")).toBeVisible({ timeout: 20_000 });
    const { data: row } = await service().from("photos").select("id").eq("guest_name", name).single();
    const id = row!.id as string;
    await expect(tile(other, id)).toHaveCount(1, { timeout: 15_000 });

    // Someone else's browser: no delete button on it.
    await tile(other, id).click();
    await expect(other.getByRole("dialog").first()).toBeVisible();
    await expect(other.getByRole("button", { name: /Delete my photo|Remove photo/ })).toHaveCount(0);
    await other.keyboard.press("Escape");

    // Mine: delete it.
    await tile(me, id).click();
    await me.getByRole("button", { name: "Delete my photo" }).click();
    await expect(me.getByRole("dialog", { name: "Delete your photo?" })).toBeVisible();
    await me.getByRole("button", { name: "Delete my photo" }).last().click();
    await expect(me.getByText("Your photo was deleted")).toBeVisible();
    await expect(tile(me, id)).toHaveCount(0);
    await expect(tile(other, id), "gone live for everyone").toHaveCount(0, { timeout: 15_000 });
    expect((await me.request.get(`${BASE}/photos/${id}`)).status()).toBe(404);
  });
});
