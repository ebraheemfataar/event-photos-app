import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { BASE, SEED_EVENT, SEED_HOST_TOKEN, seedPhoto, makeJpeg, waitForAlbumSubscription } from "./helpers";

// Phase 3: host removes photos. Opt-in like the other E2E specs (local stack +
// dev server, E2E_BASE_URL set). Tests share the seed event with parallel
// workers, so they only ever look at photos they uploaded themselves.

test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

const HOST_URL = `${BASE}/host/${SEED_EVENT}?t=${SEED_HOST_TOKEN}`;
const GUEST_URL = `${BASE}/e/${SEED_EVENT}`;
const tile = (page: Page, id: string) => page.locator(`[data-photo-id="${id}"]`);

async function openAlbum(page: Page, url: string) {
  const subscribed = waitForAlbumSubscription(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await subscribed;
}

test("host removes a photo from the viewer; it disappears for guests too", async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  await openAlbum(host, HOST_URL);
  await openAlbum(guest, GUEST_URL);

  const { id } = await seedPhoto(`Remove me ${Date.now()}`, await makeJpeg(host, "#C01F2F"));
  await expect(tile(host, id)).toHaveCount(1, { timeout: 15_000 });
  await expect(tile(guest, id)).toHaveCount(1, { timeout: 15_000 });

  await tile(host, id).click();
  await host.getByRole("button", { name: "Remove photo" }).click();
  await expect(host.getByRole("dialog", { name: "Remove this photo?" })).toBeVisible();
  await host.getByRole("button", { name: "Remove for everyone" }).click();

  await expect(host.getByText("Photo removed for everyone")).toBeVisible();
  await expect(tile(host, id)).toHaveCount(0);
  await expect(tile(guest, id), "removed live for guests").toHaveCount(0, { timeout: 15_000 });
  expect((await host.request.get(`${BASE}/photos/${id}`)).status()).toBe(404);
});

test("feed remove button, and 'Keep it' cancels", async ({ page }) => {
  await openAlbum(page, HOST_URL);
  const name = `Feed remove ${Date.now()}`;
  const { id } = await seedPhoto(name, await makeJpeg(page, "#7B4BFF"));
  await page.getByRole("tab", { name: "Feed", exact: true }).click();
  await expect(tile(page, id)).toHaveCount(1, { timeout: 15_000 });

  const removeButton = tile(page, id).getByRole("button", { name: `Remove photo by ${name.toLowerCase()}` });
  await removeButton.click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("dialog", { name: "Remove this photo?" })).toHaveCount(0);
  await expect(tile(page, id), "cancel keeps the photo").toHaveCount(1);

  await removeButton.click();
  await page.getByRole("button", { name: "Remove for everyone" }).click();
  await expect(tile(page, id)).toHaveCount(0, { timeout: 15_000 });
});

test("guests and wrong-token visitors get no remove buttons", async ({ page }) => {
  const { id } = await seedPhoto(`No remove ${Date.now()}`, await makeJpeg(page, "#FFC21A"));
  for (const url of [GUEST_URL, `${BASE}/host/${SEED_EVENT}?t=${randomUUID()}`]) {
    await openAlbum(page, url);
    await expect(tile(page, id)).toHaveCount(1, { timeout: 15_000 });
    await tile(page, id).click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Feed", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  }
});

test("demo host can remove photos locally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/demo?as=host`);
  const first = page.locator("[data-photo-id]").first();
  const id = await first.getAttribute("data-photo-id");
  await first.click();
  await page.getByRole("button", { name: "Remove photo" }).click();
  await page.getByRole("button", { name: "Remove for everyone" }).click();
  await expect(page.getByText("Photo removed (demo only)")).toBeVisible();
  await expect(page.locator(`[data-photo-id="${id}"]`)).toHaveCount(0);
});
