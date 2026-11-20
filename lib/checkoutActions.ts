"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getAddOns, getPlans, isEventHost, isUuid } from "@/lib/data";
import { payfastConfig } from "@/lib/payments/config";
import { centsToAmount, sign, type Pairs } from "@/lib/payments/payfast";
import { priceFor, type PurchaseItem } from "@/lib/purchaseRules";
import { photoCapOf } from "@/lib/plans";
import type { Event } from "@/lib/types";

// Checkout (Stage B). The host picks a plan or extra; this creates a
// "pending" purchase and returns a signed PayFast form for the browser to
// submit. Nothing is marked paid here — only the verified ITN does that
// (app/api/payfast/notify). The return page never needs the host link:
// it only shows the purchase's status.

type Failure = { ok: false; error: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `${h.get("x-forwarded-proto") ?? (local ? "http" : "https")}://${host}`;
}

export async function startCheckout(input: {
  eventId: string;
  hostToken: string;
  item: PurchaseItem;
  email: string;
}): Promise<{ ok: true; purchaseId: string; action: string; fields: Pairs } | Failure> {
  const config = payfastConfig();
  if (!config) return { ok: false, error: "Payments aren't switched on yet." };
  const { eventId, hostToken, item } = input ?? {};
  if (!isUuid(eventId) || !(await isEventHost(eventId, hostToken))) {
    return { ok: false, error: "Only the host can upgrade. Open your private host link." };
  }
  const email = String(input?.email ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Add an email address for your receipt." };

  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, plan, created_at, expires_at, extra_photos, legacy_uncapped")
    .eq("id", eventId)
    .maybeSingle<Pick<Event, "id" | "name" | "plan" | "created_at" | "expires_at" | "extra_photos" | "legacy_uncapped">>();
  if (!event) return { ok: false, error: "That album no longer exists." };

  const { data: paid } = await supabase.from("event_purchases").select("item").eq("event_id", eventId).eq("kind", "add_on").eq("status", "paid");
  const [plans, addOns] = await Promise.all([getPlans(), getAddOns()]);
  const price = priceFor(event, plans, addOns, item, (paid ?? []).map((p) => p.item));
  if (!price.ok) return price;

  const { data: purchase, error } = await supabase
    .from("event_purchases")
    .insert({ event_id: eventId, kind: item.kind, item: item.id, amount_cents: price.amountCents, email })
    .select("id")
    .single();
  if (error || !purchase) return { ok: false, error: "Couldn't start checkout. Try again." };

  const base = await origin();
  // Field order matters for the signature (PayFast signs them as sent).
  const fields: Pairs = [
    ["merchant_id", config.merchantId],
    ["merchant_key", config.merchantKey],
    ["return_url", `${base}/pay/done?p=${purchase.id}`],
    ["cancel_url", `${base}/pay/done?p=${purchase.id}&cancelled=1`],
    ["notify_url", `${base}/api/payfast/notify`],
    ["email_address", email],
    ["m_payment_id", purchase.id],
    ["amount", centsToAmount(price.amountCents)],
    ["item_name", `Snap & Share: ${price.label} for ${event.name}`.slice(0, 100)],
    ["custom_str1", eventId],
  ];
  fields.push(["signature", sign(fields, config.passphrase)]);
  return { ok: true, purchaseId: purchase.id, action: config.processUrl, fields };
}

export type PurchaseDetails = {
  status: "pending" | "paid" | "failed" | "cancelled";
  label: string;
  kind: "plan" | "add_on";
  amountCents: number;
  createdAt: string;
  paidAt: string | null;
  providerRef: string | null;
  /** "h***@example.com" — never the full address. */
  emailHint: string | null;
  event: {
    id: string;
    name: string;
    planName: string;
    photoCap: number | null;
    expiresAt: string | null;
  } | null;
};

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}***@${domain}` : null;
}

/** For the return page (/pay/done). The purchase id is the key: random, and
 * only known to the buyer and PayFast. Returns no host link and no full email. */
export async function getPurchaseDetails(purchaseId: string): Promise<PurchaseDetails | null> {
  if (!isUuid(purchaseId)) return null;
  const supabase = createServiceClient();
  const { data: p } = await supabase
    .from("event_purchases")
    .select("status, kind, item, amount_cents, created_at, paid_at, provider_ref, email, event_id")
    .eq("id", purchaseId)
    .maybeSingle<{
      status: PurchaseDetails["status"];
      kind: "plan" | "add_on";
      item: string;
      amount_cents: number;
      created_at: string;
      paid_at: string | null;
      provider_ref: string | null;
      email: string | null;
      event_id: string;
    }>();
  if (!p) return null;
  const [plans, addOns, { data: ev }] = await Promise.all([
    getPlans(),
    getAddOns(),
    supabase
      .from("events")
      .select("id, name, plan, expires_at, extra_photos, legacy_uncapped")
      .eq("id", p.event_id)
      .maybeSingle<Pick<Event, "id" | "name" | "plan" | "expires_at" | "extra_photos" | "legacy_uncapped">>(),
  ]);
  const label =
    p.kind === "plan" ? `${plans.find((x) => x.id === p.item)?.name ?? p.item} plan` : (addOns.find((a) => a.id === p.item)?.name ?? p.item);
  const plan = ev ? plans.find((x) => x.id === ev.plan) : undefined;
  return {
    status: p.status,
    label,
    kind: p.kind,
    amountCents: p.amount_cents,
    createdAt: p.created_at,
    paidAt: p.paid_at,
    providerRef: p.provider_ref,
    emailHint: maskEmail(p.email),
    event: ev
      ? {
          id: ev.id,
          name: ev.name,
          planName: plan?.name ?? ev.plan,
          photoCap: plan ? photoCapOf(ev, plan) : null,
          expiresAt: ev.expires_at,
        }
      : null,
  };
}
