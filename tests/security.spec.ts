import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { BASE, SEED_EVENT, SEED_HOST_TOKEN, localEnv, makeJpeg, waitForAlbumSubscription } from "./helpers";

// Phase 2b (docs/ROADMAP.md, 0007_lock_down_reads.sql). Opt-in like
// upload.spec.ts: needs the local stack + dev server, E2E_BASE_URL set.

test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

/** Upload a photo the way the browser does (anon storage upload + anon insert). */
async function anonUpload(guestName: string, jpeg: Buffer) {
  const { url, anonKey } = localEnv();
  const anon = createClient(url, anonKey);
  const id = randomUUID();
  const path = `${SEED_EVENT}/${id}.jpg`;
  const up = await anon.storage.from("event-photos").upload(path, jpeg, { contentType: "image/jpeg" });
  expect(up.error, "anon upload still allowed").toBeNull();
  const ins = await anon.from("photos").insert({
    id,
    event_id: SEED_EVENT,
    storage_path: path,
    guest_name: guestName,
    content_type: "image/jpeg",
  });
  expect(ins.error, "anon insert still allowed").toBeNull();
  return { id, path };
}

// Other tests upload into the same seed event in parallel, so check specific
// photos (grid tiles carry data-photo-id), never total counts.
const tile = (page: Page, id: string) => page.locator(`[data-photo-id="${id}"]`);

test("anon key can no longer list events or photos", async ({ request }) => {
  const { url, anonKey } = localEnv();
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  for (const table of ["photos", "events"]) {
    const res = await request.get(`${url}/rest/v1/${table}?select=id&limit=5`, { headers });
    const body = await res.json().catch(() => null);
    const leaked = Array.isArray(body) && body.length > 0;
    expect(leaked, `unfiltered GET /${table} must not return rows (got ${res.status()})`).toBe(false);
  }
});

test("bucket is private; photos are served by the app until deleted", async ({ page, request }) => {
  const { url, anonKey } = localEnv();
  const { id, path } = await anonUpload(`Private ${Date.now()}`, await makeJpeg(page, "#2B2BFF"));

  // The old public URL no longer works…
  const direct = await request.get(`${url}/storage/v1/object/public/event-photos/${path}`);
  expect(direct.ok(), "public storage URL must fail").toBe(false);

  // …and anon can't sign its own long-lived link either.
  const anon = createClient(url, anonKey);
  const signed = await anon.storage.from("event-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
  expect(signed.data?.signedUrl ?? null, "anon must not be able to sign URLs").toBeNull();

  // The app route serves it.
  const served = await request.get(`${BASE}/photos/${id}`);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/jpeg");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");

  // Junk ids are a plain 404.
  expect((await request.get(`${BASE}/photos/not-a-uuid`)).status()).toBe(404);
  expect((await request.get(`${BASE}/photos/${randomUUID()}`)).status()).toBe(404);

  // After the host deletes it, the route stops serving it.
  const del = await anon.rpc("delete_event_photo", { p_photo_id: id, p_host_token: SEED_HOST_TOKEN });
  expect(del.error).toBeNull();
  expect((await request.get(`${BASE}/photos/${id}`)).status()).toBe(404);
});

test("live updates: real uploads and deletes arrive, forged broadcasts are ignored", async ({ page }) => {
  const subscribed = waitForAlbumSubscription(page);
  await page.goto(`${BASE}/e/${SEED_EVENT}`);
  await subscribed;

  // A forged "photo added", sent by an attacker who knows the event id, for a
  // photo that doesn't exist must not add anything.
  const { url, anonKey } = localEnv();
  const attacker = createClient(url, anonKey);
  const channel = attacker.channel(`event:${SEED_EVENT}`);
  await new Promise<void>((resolve) => channel.subscribe((s) => s === "SUBSCRIBED" && resolve()));
  const fakeId = randomUUID();
  await channel.send({ type: "broadcast", event: "photo_inserted", payload: { id: fakeId } });
  await page.waitForTimeout(1500);
  await expect(tile(page, fakeId), "forged insert ignored").toHaveCount(0);

  // A real upload (by another browser) appears live.
  const { id } = await anonUpload(`Live ${Date.now()}`, await makeJpeg(page, "#1E7A4C"));
  await expect(tile(page, id)).toHaveCount(1, { timeout: 15_000 });

  // A forged "photo deleted" for that real photo must not remove it.
  await channel.send({ type: "broadcast", event: "photo_deleted", payload: { id } });
  await page.waitForTimeout(1500);
  await expect(tile(page, id), "forged delete ignored").toHaveCount(1);

  // A real host delete removes it live.
  const del = await attacker.rpc("delete_event_photo", { p_photo_id: id, p_host_token: SEED_HOST_TOKEN });
  expect(del.error).toBeNull();
  await expect(tile(page, id)).toHaveCount(0, { timeout: 15_000 });

  await attacker.removeChannel(channel);
});

test("host and guest pages still render for real ids, 404 for junk", async ({ page }) => {
  await page.goto(`${BASE}/host/${SEED_EVENT}?t=${SEED_HOST_TOKEN}`);
  await expect(page.getByText("Private host link").first()).toBeVisible();

  // Wrong token: view-only album (mobile and desktop headers both render, one hidden).
  await page.goto(`${BASE}/host/${SEED_EVENT}?t=${randomUUID()}`);
  await expect(page.getByText("Sam & Alex's Wedding").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Private host link")).toHaveCount(0);

  // Unknown / malformed ids show the not-found page. (The HTTP status is 200,
  // not 404: loading.tsx streams the page before the lookup finishes — see the
  // roadmap backlog. What matters here is that nothing leaks.)
  for (const id of [randomUUID(), "not-a-uuid"]) {
    await page.goto(`${BASE}/e/${id}`);
    await expect(page.getByText("We can't find this album.").first()).toBeVisible();
  }
});
