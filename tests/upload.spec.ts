import { expect, test } from "@playwright/test";
import { BASE, SEED_EVENT, SEED_HOST_TOKEN, makeJpeg, waitForAlbumSubscription } from "./helpers";

// End-to-end uploads through the real guest page. Opt-in, because it needs the
// local stack and dev server running:
//   npm run db:start && npm run db:env && npm run dev
//   E2E_BASE_URL=http://localhost:3000 npm test
// Uses the seeded event from supabase/seed.sql. Never point this at production.

test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

test("guest upload works and never loads code from a CDN", async ({ page }) => {
  const cdnRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("cdn.jsdelivr.net")) cdnRequests.push(r.url());
  });

  const subscribed = waitForAlbumSubscription(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await subscribed;
  const name = `E2E ${Date.now()}`;

  await page.getByRole("button", { name: "Add photos" }).first().click();
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: "e2e.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page) });

  // Picking only stages the photo: nothing is sent until Share.
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByText("Shared to the album")).toHaveCount(0);
  // Name (and prompt) can be filled in after picking.
  await page.getByPlaceholder("optional").fill(name);
  await page.getByRole("button", { name: "Share photo" }).click();

  // Sheet closes and the success toast shows; the photo arrives live.
  await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Feed", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });

  expect(cdnRequests, "compression must use the self-hosted worker").toEqual([]);
});

test("host can add photos from the host page, named 'Host' by default", async ({ page }) => {
  const subscribed = waitForAlbumSubscription(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/host/${SEED_EVENT}?t=${SEED_HOST_TOKEN}`);
  await subscribed;

  await page.getByRole("button", { name: "Add photos" }).first().click();
  await expect(page.getByPlaceholder("optional")).toHaveValue("Host");
  const name = `Host ${Date.now()}`;
  await page.getByPlaceholder("optional").fill(name);
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: "host.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, "#1F3A2B") });
  await page.getByRole("button", { name: "Share photo" }).click();

  await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Feed", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
});

test("wrong host token: no Add photos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/host/${SEED_EVENT}?t=00000000-0000-4000-8000-0000000000ff`);
  await expect(page.getByRole("tab", { name: "Feed", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add photos" })).toHaveCount(0);
});

/** A 1×1, two-frame animated GIF (red frame, then blue), looping forever. */
function twoFrameGif(): Buffer {
  const frame = (lzw: number[]) => [
    0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00, // graphic control: 100 ms delay
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor 1×1
    0x02, 0x02, ...lzw, 0x00, // LZW min code size 2, one data block
  ];
  return Buffer.from([
    ...Buffer.from("GIF89a"),
    0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, // 1×1, 2-colour global table
    0xff, 0x00, 0x00, 0x00, 0x00, 0xff, // red, blue
    0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00, // loop forever
    ...frame([0x44, 0x01]), // pixel = colour 0
    ...frame([0x4c, 0x01]), // pixel = colour 1
    0x3b,
  ]);
}

test("animated GIF uploads unchanged and stays animated", async ({ page }) => {
  const gif = twoFrameGif();
  const subscribed = waitForAlbumSubscription(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await subscribed;
  const name = `GIF ${Date.now()}`;

  await page.getByRole("button", { name: "Add photos" }).first().click();
  await page.getByPlaceholder("optional").fill(name);
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: "party.gif", mimeType: "image/gif", buffer: gif });
  await page.getByRole("button", { name: "Share photo" }).click();
  await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 30_000 });

  // It arrives live, and the album serves back the exact original bytes:
  // no compression on upload and no re-encoding on display, so both frames
  // survive. (Playwright can't read streamed upload bodies, so the round trip
  // is the check.)
  await page.getByRole("tab", { name: "Feed", exact: true }).click();
  const post = page.locator("article", { hasText: name });
  await expect(post).toBeVisible({ timeout: 15_000 });
  const src = await post.locator("img").last().getAttribute("src");
  expect(src).toBeTruthy();
  const res = await page.request.get(new URL(src!, BASE).href);
  expect(res.headers()["content-type"]).toBe("image/gif");
  expect(Buffer.from(await res.body()).equals(gif), "served GIF keeps both frames").toBe(true);
});

test("GIFs over 10 MB are skipped with a message", async ({ page }) => {
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await page.getByRole("button", { name: "Add photos" }).first().click();
  // A GIF header followed by 11 MB of padding: only the size matters here.
  const big = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(11 * 1024 * 1024)]);
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: "huge.gif", mimeType: "image/gif", buffer: big });
  await expect(page.getByText("1 GIF was over 10 MB and was skipped.")).toBeVisible();
});

test("staged photos can be removed before sharing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await page.getByRole("button", { name: "Add photos" }).first().click();
  const input = page.locator('input[type="file"][multiple]');
  await input.setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, "#111111") },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, "#222222") },
  ]);
  await expect(page.getByText("2 photos ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share 2 photos" })).toBeVisible();
  await page.getByRole("button", { name: "Remove photo 1" }).click();
  await expect(page.getByText("1 photo ready")).toBeVisible();
  await page.getByRole("button", { name: "Remove photo 1" }).click();
  // Back to the picker; nothing was uploaded.
  await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
});
