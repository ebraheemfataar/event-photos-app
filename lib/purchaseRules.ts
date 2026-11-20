// What a purchase costs and what it changes (docs/PRICING.md → Stage B).
// Import-free so it's unit-tested (tests/payments.spec.ts) and shared by the
// checkout Server Function and the PayFast ITN handler.

import { upgradePriceCents, type AddOn, type Plan } from "@/lib/plans";

export type PurchaseItem = { kind: "plan"; id: string } | { kind: "add_on"; id: string };

type EventLike = {
  plan: string;
  created_at: string;
  expires_at: string | null;
  extra_photos: number;
  legacy_uncapped: boolean;
};

const DAY = 86_400_000;

/** Price and a short label for checkout, or why it can't be bought. Plans
 * can only go up and cost the difference; add-ons make sense only while the
 * album has a limit to raise (and "keep 1 more year" only once). */
export function priceFor(
  event: EventLike,
  plans: Plan[],
  addOns: AddOn[],
  item: PurchaseItem,
  paidAddOns: string[] = []
): { ok: true; amountCents: number; label: string } | { ok: false; error: string } {
  const current = plans.find((p) => p.id === event.plan);
  if (!current) return { ok: false, error: "Unknown current plan." };
  const paid = event.legacy_uncapped ? 0 : current.price_cents;

  if (item?.kind === "plan") {
    const target = plans.find((p) => p.id === item.id);
    if (!target) return { ok: false, error: "Unknown plan." };
    if (target.sort_order <= current.sort_order && !event.legacy_uncapped) return { ok: false, error: "You can only move up a plan." };
    if (target.price_cents === 0) return { ok: false, error: "That plan is free." };
    const amountCents = upgradePriceCents(paid, target);
    if (amountCents <= 0) return { ok: false, error: "Nothing to pay for that plan." };
    return { ok: true, amountCents, label: `${target.name} plan` };
  }

  if (item?.kind === "add_on") {
    const addOn = addOns.find((a) => a.id === item.id);
    if (!addOn) return { ok: false, error: "Unknown add-on." };
    if (addOn.extra_photos > 0 && (current.max_photos === null || event.legacy_uncapped)) {
      return { ok: false, error: "Your album already has no photo limit." };
    }
    if (addOn.extra_retention_days > 0 && event.expires_at === null) return { ok: false, error: "Your album is already kept forever." };
    if (!addOn.stackable && paidAddOns.includes(addOn.id)) return { ok: false, error: "You already have that one." };
    return { ok: true, amountCents: addOn.price_cents, label: addOn.name };
  }

  return { ok: false, error: "Pick a plan or an extra." };
}

/** The event columns to update once a purchase is paid. */
export function effectsOf(
  event: EventLike,
  plans: Plan[],
  addOns: AddOn[],
  item: PurchaseItem,
  now = Date.now()
): Partial<Pick<EventLike, "plan" | "expires_at" | "extra_photos">> {
  if (item.kind === "plan") {
    const target = plans.find((p) => p.id === item.id);
    if (!target) return {};
    if (target.retention_days === null) return { plan: target.id, expires_at: null };
    // Kept for the plan's period from when the album started (or from now, for
    // albums made before plans) — never shorter than what it already had.
    const base = event.legacy_uncapped ? now : new Date(event.created_at).getTime();
    const candidate = base + target.retention_days * DAY;
    const existing = event.expires_at ? new Date(event.expires_at).getTime() : 0;
    return { plan: target.id, expires_at: new Date(Math.max(candidate, existing)).toISOString() };
  }
  const addOn = addOns.find((a) => a.id === item.id);
  if (!addOn) return {};
  const patch: Partial<Pick<EventLike, "expires_at" | "extra_photos">> = {};
  if (addOn.extra_photos > 0) patch.extra_photos = event.extra_photos + addOn.extra_photos;
  if (addOn.extra_retention_days > 0 && event.expires_at) {
    const from = Math.max(new Date(event.expires_at).getTime(), now);
    patch.expires_at = new Date(from + addOn.extra_retention_days * DAY).toISOString();
  }
  return patch;
}
