import { promises as dns } from "node:dns";
import { createServiceClient } from "@/lib/supabase/server";
import { getAddOns, getPlans } from "@/lib/data";
import { payfastConfig } from "@/lib/payments/config";
import { amountToCents, paramString, verifySignature, type Pairs } from "@/lib/payments/payfast";
import { effectsOf, type PurchaseItem } from "@/lib/purchaseRules";
import { sendEmail } from "@/lib/email";
import { receiptEmail } from "@/lib/emailTemplates";

// PayFast ITN (Instant Transaction Notification). The ONLY place a purchase
// becomes "paid" and an album's plan changes (docs/PRICING.md → Stage B).
// Checks, in order: our config, the signature, that the request came from
// PayFast, PayFast's own "VALID" confirmation, the merchant id, the purchase,
// and the exact amount. Repeat notifications are harmless (idempotent).

const ok = () => new Response("OK", { status: 200 });
const bad = (why: string, status = 400) => new Response(why, { status });

async function fromPayfast(request: Request, hosts: string[]): Promise<boolean> {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim();
  if (!ip) return false;
  const lists = await Promise.all(hosts.map((h) => dns.resolve4(h).catch(() => [] as string[])));
  return lists.flat().includes(ip);
}

async function payfastSaysValid(validateUrl: string, pairs: Pairs): Promise<boolean> {
  try {
    const res = await fetch(validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: paramString(pairs),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.text()).trim() === "VALID";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const config = payfastConfig();
  if (!config) return bad("Payments are off", 503);

  const body = await request.text();
  const pairs: Pairs = [...new URLSearchParams(body).entries()];
  const field = (k: string) => pairs.find(([key]) => key === k)?.[1] ?? "";

  if (!verifySignature(pairs, config.passphrase)) return bad("Bad signature");
  if (!config.skipRemoteChecks) {
    if (!(await fromPayfast(request, config.validHosts))) return bad("Not from PayFast", 403);
    if (!(await payfastSaysValid(config.validateUrl, pairs))) return bad("Not confirmed by PayFast");
  }
  if (field("merchant_id") !== config.merchantId) return bad("Wrong merchant");

  const supabase = createServiceClient();
  const { data: purchase } = await supabase
    .from("event_purchases")
    .select("id, event_id, kind, item, amount_cents, status, email")
    .eq("id", field("m_payment_id"))
    .maybeSingle<{ id: string; event_id: string; kind: "plan" | "add_on"; item: string; amount_cents: number; status: string; email: string | null }>();
  if (!purchase) return bad("Unknown purchase");
  if (amountToCents(field("amount_gross")) !== purchase.amount_cents) return bad("Amount mismatch");

  const status = field("payment_status");
  if (status !== "COMPLETE") {
    if (purchase.status === "pending") {
      await supabase
        .from("event_purchases")
        .update({ status: status === "CANCELLED" ? "cancelled" : "failed" })
        .eq("id", purchase.id)
        .eq("status", "pending");
    }
    return ok();
  }
  if (purchase.status === "paid") return ok(); // already handled

  // Claim it (only one notification can move it from pending to paid).
  const { data: claimed } = await supabase
    .from("event_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_ref: field("pf_payment_id") || null,
      notification: Object.fromEntries(pairs.filter(([k]) => k !== "signature")),
    })
    .eq("id", purchase.id)
    .in("status", ["pending", "failed", "cancelled"])
    .select("id");
  if (!claimed?.length) return ok();

  // Apply it to the album.
  const { data: event } = await supabase
    .from("events")
    .select("id, name, plan, created_at, expires_at, extra_contributors, legacy_uncapped")
    .eq("id", purchase.event_id)
    .maybeSingle();
  if (event) {
    const [plans, addOns] = await Promise.all([getPlans(), getAddOns()]);
    const item: PurchaseItem = { kind: purchase.kind, id: purchase.item };
    const patch = effectsOf(event, plans, addOns, item);
    if (Object.keys(patch).length) await supabase.from("events").update(patch).eq("id", event.id);

    if (purchase.email) {
      const plan = item.kind === "plan" ? plans.find((p) => p.id === item.id) : undefined;
      const addOn = item.kind === "add_on" ? addOns.find((a) => a.id === item.id) : undefined;
      const label = plan ? `${plan.name} plan` : (addOn?.name ?? item.id);
      const whatsNew = plan
        ? [plan.max_contributors === null ? "No guest limit" : `Up to ${plan.max_contributors} guests`, plan.retention_days === null ? "Kept forever" : "Kept longer"]
        : [label];
      await sendEmail(
        purchase.email,
        receiptEmail({
          albumName: event.name,
          label,
          amountCents: purchase.amount_cents,
          paidAt: new Date().toISOString(),
          providerRef: field("pf_payment_id") || null,
          purchaseId: purchase.id,
          whatsNew,
        })
      );
    }
  }
  return ok();
}
