import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { BASE, localEnv } from "./helpers";

// Big albums (0014): paged loading + uploaded grid thumbnails.

test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

const service = () => {
  const { url, serviceKey } = localEnv();
  return createClient(url, serviceKey);
};

async function newEvent(name: string) {
  const { url, anonKey } = localEnv();
  const { data, error } = await createClient(url, anonKey).rpc("create_event", { p_name: name });
  expect(error).toBeNull();
  const row = (data as { id: string; host_token: string }[])[0];
  return { id: row.id, hostUrl: `${BASE}/host/${row.id}?t=${row.host_token}`, guestUrl: `${BASE}/e/${row.id}` };
}

test("a 130-photo album opens with 60, shows the real totals, and loads the rest on scroll", async ({ page }) => {
  const ev = await newEvent(`Big album ${Date.now()}`);
  const base = Date.now();
  const rows = Array.from({ length: 130 }, (_, i) => ({
    id: randomUUID(),
    event_id: ev.id,
    storage_path: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80",
    content_type: "image/jpeg",
    guest_name: `Guest ${i % 7}`,
    // Some share a timestamp, to exercise the (created_at, id) tie-break.
    created_at: new Date(base - Math.floor(i / 3) * 1000).toISOString(),
  }));
  const { error } = await service().from("photos").insert(rows);
  expect(error).toBeNull();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ev.guestUrl);
  const tiles = page.locator("[data-photo-id]");
  await expect(tiles).toHaveCount(60);
  await expect(page.getByText("130", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("7", { exact: true }).first(), "distinct guest names").toBeVisible();

  for (const expected of [120, 130]) {
    await page.getByRole("button", { name: /Load more photos|Loading photos/ }).scrollIntoViewIfNeeded();
    await expect(tiles).toHaveCount(expected, { timeout: 15_000 });
  }
  await expect(page.getByRole("button", { name: /Load more photos/ }), "all loaded").toHaveCount(0);
  const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("data-photo-id")));
  expect(new Set(ids).size, "no duplicates").toBe(130);
});

test("uploads come with a small thumbnail the grid uses; deleting removes both files", async ({ page }) => {
  const ev = await newEvent(`Thumb album ${Date.now()}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ev.guestUrl);
  // A big photo, so the thumbnail is clearly smaller.
  const big = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 2400;
    c.height = 1800;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 2400, 1800);
    g.addColorStop(0, "#FF5A1F");
    g.addColorStop(1, "#2B2BFF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2400, 1800);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByRole("button", { name: "Add photos" }).first().click();
  await page.locator('input[type="file"][multiple]').setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: Buffer.from(big) });
  await page.getByRole("button", { name: "Share photo" }).click();
  await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 30_000 });

  const { data: row } = await service().from("photos").select("id, storage_path, thumb_path").eq("event_id", ev.id).single();
  expect(row!.thumb_path).toBe(`${ev.id}/${row!.id}.thumb.jpg`);

  const full = await page.request.get(`${BASE}/photos/${row!.id}`);
  const thumb = await page.request.get(`${BASE}/photos/${row!.id}/thumb`);
  expect(thumb.status()).toBe(200);
  expect(thumb.headers()["content-type"]).toBe("image/jpeg");
  expect((await thumb.body()).length).toBeLessThan((await full.body()).length / 3);

  const tileImg = page.locator(`[data-photo-id="${row!.id}"] img`);
  await expect(tileImg).toHaveAttribute("src", `/photos/${row!.id}/thumb`);

  // A photo without a thumbnail just uses the full one.
  expect((await page.request.get(`${BASE}/photos/${randomUUID()}/thumb`)).status()).toBe(404);

  // Deleting the photo removes the thumbnail file too.
  await page.locator(`[data-photo-id="${row!.id}"]`).click();
  await page.getByRole("button", { name: "Delete my photo" }).click();
  await page.getByRole("button", { name: "Delete my photo" }).last().click();
  await expect(page.getByText("Your photo was deleted")).toBeVisible();
  const { data: files } = await service().storage.from("event-photos").list(ev.id);
  expect(files?.filter((f) => f.id !== null).map((f) => f.name) ?? []).toEqual([]);
});
