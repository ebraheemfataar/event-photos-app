import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { amountToCents, centsToAmount, ipInRanges, itnParamString, paramString, phpUrlencode, sign, verifyItnSignature, verifySignature, type Pairs } from "../lib/payments/payfast";
import { effectsOf, priceFor } from "../lib/purchaseRules";
import type { AddOn, Plan } from "../lib/plans";
import { BASE, guestHash, localEnv, makeJpeg } from "./helpers";

// Monetisation Stage B: PayFast checkout + ITN (lib/payments, lib/checkoutActions,
// app/api/payfast/notify) and the guest cap (lib/uploadActions).

const PLANS: Plan[] = [
  { id: "free", name: "Free", price_cents: 0, max_contributors: 20, retention_days: 30, shows_badge: true, sort_order: 1 },
  { id: "small", name: "Small", price_cents: 14900, max_contributors: 100, retention_days: 90, shows_badge: true, sort_order: 2 },
  { id: "medium", name: "Medium", price_cents: 39900, max_contributors: 300, retention_days: 365, shows_badge: false, sort_order: 3 },
  { id: "unlimited", name: "Unlimited", price_cents: 79900, max_contributors: null, retention_days: null, shows_badge: false, sort_order: 4 },
];
const ADD_ONS: AddOn[] = [
  { id: "keep_1yr", name: "Keep for 1 more year", price_cents: 4900, extra_contributors: 0, extra_retention_days: 365, stackable: false, sort_order: 1 },
  { id: "guests_50", name: "+50 guests", price_cents: 7900, extra_contributors: 50, extra_retention_days: 0, stackable: true, sort_order: 2 },
];
const DAY = 86_400_000;

test.describe("signatures and amounts", () => {
  test("PHP-style encoding, blank fields skipped, passphrase matters, tampering fails", () => {
    expect(phpUrlencode("a b!'()*~&=")).toBe("a+b%21%27%28%29%2A%7E%26%3D");
    const fields: Pairs = [["merchant_id", "10000100"], ["blank", " "], ["amount", "399.00"], ["item_name", "Snap & Share: Medium plan"]];
    expect(paramString(fields)).toBe("merchant_id=10000100&amount=399.00&item_name=Snap+%26+Share%3A+Medium+plan");
    const signed: Pairs = [...fields, ["signature", sign(fields, "secret pass")]];
    expect(verifySignature(signed, "secret pass")).toBe(true);
    expect(verifySignature(signed, "other")).toBe(false);
    expect(verifySignature(signed.map(([k, v]) => [k, k === "amount" ? "1.00" : v] as [string, string]), "secret pass")).toBe(false);
    expect(verifySignature(fields, "secret pass"), "no signature").toBe(false);
  });

  test("ITN signatures keep blank fields (PayFast's ITN rules)", () => {
    const fields: Pairs = [["m_payment_id", "abc"], ["name_first", "Test"], ["name_last", ""], ["amount_gross", "399.00"]];
    expect(itnParamString([...fields, ["signature", "x"], ["after", "ignored"]])).toBe("m_payment_id=abc&name_first=Test&name_last=&amount_gross=399.00");
    const sig = createHash("md5").update(`${itnParamString(fields)}&passphrase=secret+pass`).digest("hex");
    expect(verifyItnSignature([...fields, ["signature", sig]], "secret pass")).toBe(true);
    expect(verifyItnSignature([...fields, ["signature", sig]], "other")).toBe(false);
    // The checkout-form rule (blanks dropped) gives a different string, which was the production bug.
    expect(verifySignature([...fields, ["signature", sig]], "secret pass")).toBe(false);
  });

  test("PayFast source IP ranges", () => {
    expect(ipInRanges("197.97.145.150")).toBe(true);
    expect(ipInRanges("41.74.179.200")).toBe(true);
    expect(ipInRanges("144.126.193.139")).toBe(true);
    expect(ipInRanges("144.126.193.140")).toBe(false);
    expect(ipInRanges("8.8.8.8")).toBe(false);
    expect(ipInRanges("not-an-ip")).toBe(false);
  });

  test("cents ↔ PayFast amounts", () => {
    expect(centsToAmount(39900)).toBe("399.00");
    expect(centsToAmount(4950)).toBe("49.50");
    expect(amountToCents("399.00")).toBe(39900);
    expect(amountToCents("49.5")).toBe(4950);
    expect(amountToCents("1e3")).toBeNull();
    expect(amountToCents("-5")).toBeNull();
  });
});

test.describe("pricing rules", () => {
  const ev = { plan: "free", created_at: "2026-11-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", extra_contributors: 0, legacy_uncapped: false };

  test("upgrades cost the difference; no downgrades; extras only where they make sense", () => {
    expect(priceFor(ev, PLANS, ADD_ONS, { kind: "plan", id: "medium" })).toMatchObject({ ok: true, amountCents: 39900 });
    expect(priceFor({ ...ev, plan: "small" }, PLANS, ADD_ONS, { kind: "plan", id: "medium" })).toMatchObject({ ok: true, amountCents: 25000 });
    expect(priceFor({ ...ev, plan: "medium" }, PLANS, ADD_ONS, { kind: "plan", id: "small" }).ok).toBe(false);
    expect(priceFor(ev, PLANS, ADD_ONS, { kind: "plan", id: "free" }).ok).toBe(false);
    expect(priceFor(ev, PLANS, ADD_ONS, { kind: "add_on", id: "guests_50" })).toMatchObject({ ok: true, amountCents: 7900 });
    expect(priceFor({ ...ev, plan: "unlimited", expires_at: null }, PLANS, ADD_ONS, { kind: "add_on", id: "guests_50" }).ok).toBe(false);
    expect(priceFor({ ...ev, plan: "unlimited", expires_at: null }, PLANS, ADD_ONS, { kind: "add_on", id: "keep_1yr" }).ok).toBe(false);
    expect(priceFor(ev, PLANS, ADD_ONS, { kind: "add_on", id: "keep_1yr" }, ["keep_1yr"]).ok, "once only").toBe(false);
    expect(priceFor(ev, PLANS, ADD_ONS, { kind: "add_on", id: "guests_50" }, ["guests_50"]).ok, "stackable").toBe(true);
  });

  test("what a paid purchase changes", () => {
    const now = Date.parse("2026-11-20T00:00:00Z");
    expect(effectsOf(ev, PLANS, ADD_ONS, { kind: "plan", id: "medium" }, now)).toEqual({
      plan: "medium",
      expires_at: new Date(Date.parse(ev.created_at) + 365 * DAY).toISOString(),
    });
    expect(effectsOf(ev, PLANS, ADD_ONS, { kind: "plan", id: "unlimited" }, now)).toEqual({ plan: "unlimited", expires_at: null });
    // Early album: kept from now, not from when it was made.
    expect(effectsOf({ ...ev, legacy_uncapped: true, expires_at: null, created_at: "2025-01-01T00:00:00Z" }, PLANS, ADD_ONS, { kind: "plan", id: "small" }, now))
      .toEqual({ plan: "small", expires_at: new Date(now + 90 * DAY).toISOString() });
    expect(effectsOf(ev, PLANS, ADD_ONS, { kind: "add_on", id: "guests_50" }, now)).toEqual({ extra_contributors: 50 });
    expect(effectsOf(ev, PLANS, ADD_ONS, { kind: "add_on", id: "keep_1yr" }, now)).toEqual({
      expires_at: new Date(Date.parse(ev.expires_at) + 365 * DAY).toISOString(),
    });
  });
});

test.describe("end-to-end", () => {
  test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

  // Your PayFast sandbox account, from .env.development.local.
  const MERCHANT_ID = localEnv().payfastMerchantId ?? "";
  const PASSPHRASE = localEnv().payfastPassphrase ?? "";
  test.skip(!MERCHANT_ID, "set your PayFast sandbox account in .env.development.local");

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

  function itn(purchaseId: string, amount: string, status = "COMPLETE", passphrase = PASSPHRASE): string {
    const fields: Pairs = [
      ["m_payment_id", purchaseId],
      ["pf_payment_id", String(Math.floor(Math.random() * 1e9))],
      ["payment_status", status],
      ["name_first", "Test"],
      ["name_last", ""], // PayFast sends blank fields and signs them
      ["item_name", "Snap & Share test"],
      ["amount_gross", amount],
      ["amount_fee", "-9.20"],
      ["amount_net", "389.80"],
      ["merchant_id", MERCHANT_ID],
    ];
    const base = itnParamString(fields);
    const sig = createHash("md5").update(passphrase ? `${base}&passphrase=${phpUrlencode(passphrase)}` : base).digest("hex");
    return `${base}&signature=${sig}`;
  }

  test("checkout: signed form to PayFast; only a valid ITN upgrades the album, once", async ({ page, request }) => {
    const ev = await newEvent(`Pay test ${Date.now()}`);
    // Catch the form the browser posts to PayFast instead of leaving the app.
    let posted: Pairs | null = null;
    await page.route("https://sandbox.payfast.co.za/**", async (route) => {
      posted = [...new URLSearchParams(route.request().postData() ?? "").entries()];
      await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>PayFast sandbox (stubbed)</h1>" });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ev.hostUrl);
    await page.getByRole("button", { name: /^Plan:/ }).first().click();
    const sheet = page.getByRole("dialog", { name: "Your plan" });
    await sheet.getByRole("radio", { name: /Medium/ }).click();
    await page.getByLabel("Email for your receipt").fill("host@example.com");
    await page.getByRole("button", { name: "Continue to payment · R399" }).click();
    await expect(page.getByText("PayFast sandbox (stubbed)")).toBeVisible({ timeout: 15_000 });

    const fields = posted as unknown as Pairs;
    const get = (k: string) => fields.find(([key]) => key === k)?.[1];
    expect(get("amount")).toBe("399.00");
    expect(get("merchant_id")).toBe(MERCHANT_ID);
    expect(get("email_address")).toBe("host@example.com");
    expect(get("return_url")).not.toContain("?t="); // the host link never goes to PayFast
    expect(verifySignature(fields, PASSPHRASE)).toBe(true);
    const purchaseId = get("m_payment_id")!;

    const { data: before } = await service().from("event_purchases").select("status, amount_cents").eq("id", purchaseId).single();
    expect(before).toEqual({ status: "pending", amount_cents: 39900 });

    const post = (body: string) =>
      request.post(`${BASE}/api/payfast/notify`, { data: body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });

    // Forged signature, then the wrong amount: refused, nothing changes.
    expect((await post(itn(purchaseId, "399.00", "COMPLETE", "wrong passphrase"))).status()).toBe(400);
    expect((await post(itn(purchaseId, "1.00"))).status()).toBe(400);
    let { data: evNow } = await service().from("events").select("plan").eq("id", ev.id).single();
    expect(evNow!.plan).toBe("free");

    // The real one upgrades the album.
    expect((await post(itn(purchaseId, "399.00"))).status()).toBe(200);
    ({ data: evNow } = await service().from("events").select("plan").eq("id", ev.id).single());
    expect(evNow!.plan).toBe("medium");
    const { data: after } = await service().from("event_purchases").select("status, paid_at, provider_ref").eq("id", purchaseId).single();
    expect(after!.status).toBe("paid");

    // A repeat notification is harmless.
    expect((await post(itn(purchaseId, "399.00"))).status()).toBe(200);
    const { data: again } = await service().from("event_purchases").select("paid_at, provider_ref").eq("id", purchaseId).single();
    expect(again).toEqual({ paid_at: after!.paid_at, provider_ref: after!.provider_ref });

    // The return page reports it (and never needed the host link).
    await page.unroute("https://sandbox.payfast.co.za/**");
    await page.goto(`${BASE}/pay/done?p=${purchaseId}`);
    await expect(page.getByRole("heading", { name: "Payment successful" })).toBeVisible();
    await expect(page.getByText(/Medium plan is now on/)).toBeVisible();
    await expect(page.getByText("Up to 300 guests can share")).toBeVisible();
    // Finds the album via "Your albums" (saved when the host page opened).
    await page.getByRole("link", { name: /^Back to Pay test/ }).click();
    await expect(page.getByRole("button", { name: /^Plan: Medium/ }).first()).toBeVisible();
  });

  test("unknown purchases and cancelled payments", async ({ request }) => {
    const post = (body: string) =>
      request.post(`${BASE}/api/payfast/notify`, { data: body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    expect((await post(itn(randomUUID(), "399.00"))).status()).toBe(400);
    expect((await post("not=a&signed=body")).status()).toBe(400);

    const ev = await newEvent(`Cancel test ${Date.now()}`);
    const { data: p } = await service()
      .from("event_purchases")
      .insert({ event_id: ev.id, kind: "plan", item: "small", amount_cents: 14900 })
      .select("id")
      .single();
    expect((await post(itn(p!.id, "149.00", "CANCELLED"))).status()).toBe(200);
    const { data } = await service().from("event_purchases").select("status").eq("id", p!.id).single();
    expect(data!.status).toBe("cancelled");
  });

  test("guest cap: a new guest beyond the Free limit is turned away; existing guests keep sharing", async ({ page }) => {
    const ev = await newEvent(`Cap test ${Date.now()}`);
    const guests = Array.from({ length: 20 }, () => randomUUID());
    const rows = guests.map((g) => ({
      id: randomUUID(),
      event_id: ev.id,
      storage_path: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80",
      content_type: "image/jpeg",
      guest_hash: guestHash(g),
    }));
    expect((await service().from("photos").insert(rows)).error).toBeNull();

    const tryUpload = async (guestId: string) => {
      const ctx = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
      const p = await ctx.newPage();
      await p.addInitScript((id) => localStorage.setItem("snap-guest-id", id), guestId);
      await p.goto(ev.guestUrl);
      await p.getByRole("button", { name: "Add photos" }).first().click();
      await p.locator('input[type="file"][multiple]').setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(p) });
      await p.getByRole("button", { name: "Share photo" }).click();
      return { p, ctx };
    };

    const newcomer = await tryUpload(randomUUID());
    await expect(newcomer.p.getByText(/This album is full/)).toBeVisible({ timeout: 20_000 });
    await newcomer.ctx.close();

    const regular = await tryUpload(guests[0]);
    await expect(regular.p.getByText("Shared to the album")).toBeVisible({ timeout: 20_000 });
    await regular.ctx.close();
  });
});
