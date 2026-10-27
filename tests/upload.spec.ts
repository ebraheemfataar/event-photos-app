import { expect, test } from "@playwright/test";

// End-to-end upload through the real guest page. Opt-in, because it needs the
// local stack and dev server running:
//   npm run db:start && npm run db:env && npm run dev
//   E2E_BASE_URL=http://localhost:3000 npm test
// Uses the seeded event from supabase/seed.sql. Never point this at production.

const BASE = process.env.E2E_BASE_URL;
const SEED_EVENT = "00000000-0000-4000-8000-000000000001";

test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

test("guest upload works and never loads code from a CDN", async ({ page }) => {
  const cdnRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("cdn.jsdelivr.net")) cdnRequests.push(r.url());
  });

  // Wait for the album's realtime subscription before uploading; on a cold
  // dev server the page can still be compiling when the upload finishes.
  const subscribed = new Promise<void>((resolve) => {
    page.on("websocket", (ws) => {
      if (!ws.url().includes("/realtime/")) return;
      ws.on("framereceived", (f) => {
        if (String(f.payload).includes("Subscribed to PostgreSQL")) resolve();
      });
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await subscribed;
  const name = `E2E ${Date.now()}`;

  await page.getByRole("button", { name: "Add photos" }).first().click();
  await page.getByPlaceholder("optional").fill(name);

  // Build a real JPEG in the page and hand it to the library input.
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FF5A1F";
    ctx.fillRect(0, 0, 1200, 900);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: "e2e.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });

  // Sheet closes and the success toast shows; the photo arrives via realtime.
  await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Feed" }).first().click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });

  expect(cdnRequests, "compression must use the self-hosted worker").toEqual([]);
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

  const subscribed = new Promise<void>((resolve) => {
    page.on("websocket", (ws) => {
      if (!ws.url().includes("/realtime/")) return;
      ws.on("framereceived", (f) => {
        if (String(f.payload).includes("Subscribed to PostgreSQL")) resolve();
      });
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await subscribed;
  const name = `GIF ${Date.now()}`;

  await page.getByRole("button", { name: "Add photos" }).first().click();
  await page.getByPlaceholder("optional").fill(name);
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: "party.gif", mimeType: "image/gif", buffer: gif });
  await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 30_000 });

  // It arrives live, and the album serves back the exact original bytes:
  // no compression on upload and no re-encoding on display, so both frames
  // survive. (Playwright can't read streamed upload bodies, so the round trip
  // is the check.)
  await page.getByRole("button", { name: "Feed" }).first().click();
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
