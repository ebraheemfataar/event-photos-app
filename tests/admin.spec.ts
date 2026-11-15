import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { newSessionToken, tokenValid } from "../lib/admin/token";
import { BASE, localEnv, makeJpeg } from "./helpers";

// Admin portal (0012_admin.sql, lib/admin/*, app/admin/*).

test.describe("session tokens", () => {
  test.beforeAll(() => {
    process.env.ADMIN_PASSWORD = "unit-test-password-123";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-key";
  });

  test("valid until it expires; tampering and password changes invalidate it", () => {
    const now = Date.parse("2026-11-15T10:00:00Z");
    const token = newSessionToken(now);
    expect(tokenValid(token, now + 60_000)).toBe(true);
    expect(tokenValid(token, now + 13 * 3600_000), "expires after 12 h").toBe(false);
    const [exp, sig] = token.split(".");
    expect(tokenValid(`${Number(exp) + 86400}.${sig}`, now), "can't extend the expiry").toBe(false);
    expect(tokenValid(`${exp}.${"0".repeat(64)}`, now)).toBe(false);
    expect(tokenValid("garbage", now)).toBe(false);
    process.env.ADMIN_PASSWORD = "a-different-password-456";
    expect(tokenValid(token, now + 60_000), "new password signs everyone out").toBe(false);
    process.env.ADMIN_PASSWORD = "short";
    expect(tokenValid(newSessionToken(now), now), "too-short password = portal off").toBe(false);
  });
});

test.describe("end-to-end", () => {
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
    return { id: row.id, token: row.host_token };
  }

  async function signIn(page: Page) {
    await page.goto(`${BASE}/admin/login`);
    await page.getByLabel("Admin password").fill(localEnv().adminPassword!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${BASE}/admin`);
  }

  test("signed-out visitors are sent to the sign-in page; wrong passwords are refused", async ({ browser }) => {
    // Its own (pretend) network, so this deliberate failure never counts
    // towards the lockout of the other tests' sign-ins.
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
    const page = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } })).newPage();
    for (const path of ["/admin", "/admin/events/00000000-0000-4000-8000-000000000001"]) {
      await page.goto(`${BASE}${path}`);
      await expect(page).toHaveURL(`${BASE}/admin/login`);
    }
    await page.getByLabel("Admin password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That password isn't right.")).toBeVisible();
    const { data } = await service().from("admin_audit").select("action").eq("action", "login_failed").limit(1);
    expect(data?.length, "failed sign-in is logged").toBe(1);
  });

  test("list, search, close uploads, delete a photo, delete the album, sign out", async ({ page }) => {
    const name = `Admin test ${Date.now()}`;
    const ev = await newEvent(name);
    const jpeg = await makeJpeg(page, "#335577");
    const photoId = crypto.randomUUID();
    const path = `${ev.id}/${photoId}.jpg`;
    await service().storage.from("event-photos").upload(path, jpeg, { contentType: "image/jpeg" });
    await service().from("photos").insert({ id: photoId, event_id: ev.id, storage_path: path, guest_name: "Ada", content_type: "image/jpeg" });

    await signIn(page);
    await page.getByLabel("Search albums").fill(name);
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    // The buttons only work once the page script has loaded (slow while the
    // dev server compiles for other tests in parallel).
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "Open as host ↗" })).toHaveAttribute("href", `/host/${ev.id}?t=${ev.token}`);

    // Close uploads → the album stops taking photos.
    await page.getByRole("button", { name: "Close uploads" }).click();
    await expect(page.getByRole("button", { name: "Reopen uploads" })).toBeVisible();
    const { data: closed } = await service().from("events").select("is_active").eq("id", ev.id).single();
    expect(closed!.is_active).toBe(false);

    // Delete the photo (two taps) → row and file gone.
    await page.locator(`[data-photo-id="${photoId}"]`).hover();
    await page.getByRole("button", { name: "Delete photo" }).click();
    await page.getByRole("button", { name: "Confirm delete photo" }).click();
    await expect(page.locator(`[data-photo-id="${photoId}"]`)).toHaveCount(0);
    expect((await page.request.get(`${BASE}/photos/${photoId}`)).status()).toBe(404);

    // Delete the album: needs the exact name.
    await page.getByRole("button", { name: "Delete album…" }).click();
    const confirm = page.getByRole("button", { name: "Delete for good" });
    await page.getByLabel("Type the album name to confirm").fill("wrong");
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type the album name to confirm").fill(name);
    await confirm.click();
    await expect(page.getByText(`Deleted “${name}” and all its photos.`)).toBeVisible();
    const { data: gone } = await service().from("events").select("id").eq("id", ev.id).maybeSingle();
    expect(gone).toBeNull();
    const { data: log } = await service().from("admin_audit").select("action").eq("event_id", ev.id);
    expect(log?.map((r) => r.action).sort()).toEqual(["album_deleted", "photo_deleted", "uploads_closed"]);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${BASE}/admin/login`);
    await page.goto(`${BASE}/admin`);
    await expect(page).toHaveURL(`${BASE}/admin/login`);
  });

  test("admin pages are noindex and the session cookie is httpOnly + scoped to /admin", async ({ page, context }) => {
    await signIn(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const cookie = (await context.cookies()).find((c) => c.name === "snap_admin");
    expect(cookie).toMatchObject({ httpOnly: true, path: "/admin", sameSite: "Strict" });
  });
});
