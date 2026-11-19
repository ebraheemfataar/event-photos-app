import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { formatRand, isExpired, planMood, planStatus, upgradePriceCents, type Plan } from "../lib/plans";
import { BASE, localEnv, makeJpeg, waitForAlbumSubscription } from "./helpers";

// Monetisation Stage A (0011_plans.sql, lib/plans.ts, app/api/cron/expire).

const FREE: Plan = { id: "free", name: "Free", price_cents: 0, max_contributors: 20, retention_days: 30, shows_badge: true, sort_order: 1 };
const UNLIMITED: Plan = { ...FREE, id: "unlimited", name: "Unlimited", price_cents: 79900, max_contributors: null, retention_days: null };
const DAY = 86_400_000;

test("planStatus: cap, add-on slots, days left, legacy", () => {
  const now = Date.parse("2026-11-12T10:00:00Z");
  const event = { plan: "free", expires_at: new Date(now + 10 * DAY + 3600_000).toISOString(), extra_contributors: 50, legacy_uncapped: false };
  const s = planStatus(event, FREE, { photos: 40, contributors: 7 }, now);
  expect(s.contributorCap).toBe(70);
  expect(s.daysLeft).toBe(10);
  expect(planStatus({ ...event, legacy_uncapped: true }, FREE, { photos: 0, contributors: 0 }, now).contributorCap).toBeNull();
  expect(planStatus({ ...event, expires_at: null }, UNLIMITED, { photos: 0, contributors: 0 }, now)).toMatchObject({ contributorCap: null, daysLeft: null });
  expect(planStatus({ ...event, expires_at: new Date(now - DAY).toISOString() }, FREE, { photos: 0, contributors: 0 }, now).daysLeft).toBe(0);
});

test("upgrade price is the difference, never negative; mood thresholds", () => {
  const MEDIUM: Plan = { ...FREE, id: "medium", name: "Medium", price_cents: 39900, max_contributors: 300, retention_days: 365 };
  expect(upgradePriceCents(14900, MEDIUM)).toBe(25000);
  expect(upgradePriceCents(0, MEDIUM)).toBe(39900);
  expect(upgradePriceCents(79900, MEDIUM)).toBe(0);
  const now = Date.parse("2026-11-12T10:00:00Z");
  const ev = { plan: "free", expires_at: new Date(now + 20 * DAY).toISOString(), extra_contributors: 0, legacy_uncapped: false };
  expect(planMood(planStatus(ev, FREE, { photos: 0, contributors: 4 }, now))).toBe("ok");
  expect(planMood(planStatus(ev, FREE, { photos: 0, contributors: 18 }, now))).toBe("near");
  expect(planMood(planStatus(ev, FREE, { photos: 0, contributors: 20 }, now))).toBe("full");
  expect(planMood(planStatus({ ...ev, expires_at: new Date(now + 3 * DAY).toISOString() }, FREE, { photos: 0, contributors: 1 }, now))).toBe("near");
  expect(planMood(planStatus({ ...ev, legacy_uncapped: true, expires_at: null }, FREE, { photos: 0, contributors: 500 }, now))).toBe("ok");
});

test("money and expiry helpers", () => {
  expect(formatRand(14900)).toBe("R149");
  expect(formatRand(0)).toBe("R0");
  expect(formatRand(4950)).toBe("R49.50");
  expect(isExpired(null)).toBe(false);
  expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  expect(isExpired(new Date(Date.now() + DAY).toISOString())).toBe(false);
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
    return { id: row.id, hostUrl: `${BASE}/host/${row.id}?t=${row.host_token}`, guestUrl: `${BASE}/e/${row.id}` };
  }

  test("new events start on Free (20 guests, 30 days); the host sees usage", async ({ page }) => {
    const ev = await newEvent(`Plan test ${Date.now()}`);
    const { data } = await service().from("events").select("plan, expires_at, created_at, legacy_uncapped").eq("id", ev.id).single();
    expect(data!.plan).toBe("free");
    expect(data!.legacy_uncapped).toBe(false);
    const days = (Date.parse(data!.expires_at) - Date.parse(data!.created_at)) / DAY;
    expect(Math.round(days)).toBe(30);

    // A guest shares a photo → 1 contributor.
    const subscribed = waitForAlbumSubscription(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ev.guestUrl);
    await subscribed;
    await expect(page.getByRole("button", { name: /^Plan:/ }), "guests never see the plan").toHaveCount(0);
    await page.getByRole("button", { name: "Add photos" }).first().click();
    await page.locator('input[type="file"][multiple]').setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page) });
    await page.getByRole("button", { name: "Share photo" }).click();
    await expect(page.getByText("Shared to the album")).toBeVisible({ timeout: 20_000 });

    await page.goto(ev.hostUrl);
    const chip = page.getByRole("button", { name: /^Plan: Free · 1\/20 guests · 29 days left$/ }).first();
    await expect(chip).toBeVisible();
    await chip.click();
    const sheet = page.getByRole("dialog", { name: "Your plan" });
    await expect(sheet.getByText("of 20 guests")).toBeVisible();
    await expect(sheet.getByText("19 spots left")).toBeVisible();
    // Tap a plan: the upgrade price shows. Locally PayFast's sandbox is
    // configured, so checkout is offered (production shows "coming soon"
    // until payments are switched on).
    await sheet.getByRole("radio", { name: /Medium/ }).click();
    await expect(sheet.getByText("Upgrade to Medium · R399")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to payment · R399" })).toBeEnabled();
  });

  test("home page shows the plans from the database; only Free can be started", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.getByRole("link", { name: "Pricing" }).click();
    const pricing = page.locator("#pricing");
    await expect(pricing.getByText("R149")).toBeVisible();
    await expect(pricing.getByText("R399")).toBeVisible();
    await expect(pricing.getByText("Up to 20 guests sharing")).toBeVisible();
    // Payments are on locally: paid plans offer "Choose", which picks the plan
    // in the create form.
    await expect(pricing.getByRole("link", { name: /^Choose / })).toHaveCount(3);
    await pricing.getByRole("link", { name: "Choose Medium" }).click();
    await expect(page).toHaveURL(/#create$/);
    await expect(page.getByRole("radio", { name: /Medium/ })).toHaveAttribute("aria-checked", "true");
    await page.goto(`${BASE}/`);
    await page.locator("#pricing").getByRole("link", { name: "Start free" }).click();
    await expect(page).toHaveURL(/#create$/);
  });

  test("desktop host sidebar has a Plan item that opens the plan sheet", async ({ page }) => {
    const ev = await newEvent(`Sidebar plan ${Date.now()}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(ev.hostUrl);
    const item = page.getByRole("button", { name: /^Plan · Free/ });
    await expect(item).toContainText("0/20 guests · 29 days left");
    await item.click();
    await expect(page.getByRole("dialog", { name: "Your plan" })).toBeVisible();
    // Guests never see it.
    await page.goto(ev.guestUrl);
    await expect(page.getByRole("button", { name: /^Plan · / })).toHaveCount(0);
  });

  test("Made with Snap & Share badge: shown on Free, hidden on Medium (album + QR card)", async ({ page }) => {
    const ev = await newEvent(`Badge test ${Date.now()}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ev.guestUrl);
    await expect(page.getByRole("link", { name: "Made with Snap & Share" })).toBeVisible();
    await page.goto(ev.hostUrl);
    await expect(page.locator("#invite").getByText("Made with Snap & Share")).toBeVisible();

    await service().from("events").update({ plan: "medium" }).eq("id", ev.id);
    await page.goto(ev.guestUrl);
    await expect(page.getByText("Made with Snap & Share")).toHaveCount(0);
    await page.goto(ev.hostUrl);
    await expect(page.getByText("Made with Snap & Share")).toHaveCount(0);
  });

  test("events from before pricing have no cap and no expiry", async ({ page }) => {
    const ev = await newEvent(`Legacy test ${Date.now()}`);
    await service().from("events").update({ legacy_uncapped: true, expires_at: null }).eq("id", ev.id);
    await page.goto(ev.hostUrl);
    await expect(page.getByRole("button", { name: /^Plan: Early album · no limit$/ }).first()).toBeVisible();
  });

  test("uploads stop once an album is past its deletion date", async ({ page }) => {
    const ev = await newEvent(`Expired upload ${Date.now()}`);
    await service().from("events").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", ev.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ev.guestUrl);
    await page.getByRole("button", { name: "Add photos" }).first().click();
    await page.locator('input[type="file"][multiple]').setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page) });
    await page.getByRole("button", { name: "Share photo" }).click();
    await expect(page.getByText(/has expired and is closed/)).toBeVisible({ timeout: 20_000 });
  });

  test("expiry job: needs the secret, and only reports unless deletion is on", async ({ request }) => {
    expect((await request.get(`${BASE}/api/cron/expire`)).status()).toBe(401);
    expect((await request.get(`${BASE}/api/cron/expire`, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);

    const ev = await newEvent(`Expired job ${Date.now()}`);
    // The job handles the 25 most overdue albums first. Make this one older
    // than any left over from earlier runs (later runs go further back).
    const longAgo = new Date(Date.UTC(2000, 0, 1) - (Date.now() - Date.UTC(2026, 0, 1)));
    await service().from("events").update({ expires_at: longAgo.toISOString() }).eq("id", ev.id);
    const res = await request.get(`${BASE}/api/cron/expire`, { headers: { Authorization: `Bearer ${localEnv().cronSecret}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("report-only");
    expect(body.due).toContain(ev.id);
    const { data } = await service().from("events").select("id").eq("id", ev.id).maybeSingle();
    expect(data, "report-only never deletes").not.toBeNull();
  });
});
