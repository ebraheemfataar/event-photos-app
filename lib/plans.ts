// Plan maths (Monetisation Stage A). The numbers themselves come from the
// `plans` / `add_ons` tables (0011_plans.sql) via lib/data.ts; this file only
// combines them, so it's import-free and unit-tested in tests/plans.spec.ts.

export type Plan = {
  id: string;
  name: string;
  price_cents: number;
  max_photos: number | null; // null = no limit
  retention_days: number | null; // null = forever
  shows_badge: boolean;
  sort_order: number;
};

export type AddOn = {
  id: string;
  name: string;
  price_cents: number;
  extra_photos: number;
  extra_retention_days: number;
  stackable: boolean;
  sort_order: number;
};

export type PlanStatus = {
  planId: string;
  planName: string;
  /** The plan's price; what the host has paid for this event so far. */
  priceCents: number;
  /** Every photo in the album, the host's included. */
  photos: number;
  /** Plan limit + extra photos bought; null = no limit (an event from before pricing). */
  photoCap: number | null;
  /** ISO date-time, or null = never deleted. */
  expiresAt: string | null;
  /** Whole days left (0 on the last day), or null when it never expires. */
  daysLeft: number | null;
  /** Created before pricing: no cap, no expiry until pricing launches. */
  legacy: boolean;
  showsBadge: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

export function planStatus(
  event: { plan: string; expires_at: string | null; extra_photos: number; legacy_uncapped: boolean },
  plan: Plan,
  usage: { photos: number },
  now = Date.now()
): PlanStatus {
  const cap = photoCapOf(event, plan);
  const expiresAt = event.expires_at;
  const daysLeft = expiresAt === null ? null : Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / DAY));
  return {
    planId: plan.id,
    planName: plan.name,
    priceCents: event.legacy_uncapped ? 0 : plan.price_cents,
    photos: usage.photos,
    photoCap: cap,
    expiresAt,
    daysLeft,
    legacy: event.legacy_uncapped,
    showsBadge: plan.shows_badge,
  };
}

/** How many photos the album may hold, or null for no limit. */
export function photoCapOf(event: { extra_photos: number; legacy_uncapped: boolean }, plan: Pick<Plan, "max_photos">): number | null {
  if (event.legacy_uncapped || plan.max_photos === null) return null;
  return plan.max_photos + (event.extra_photos ?? 0);
}

/** What an upgrade costs: the new plan minus what's already been paid for
 * this event (PRICING.md: "charging only the difference"). Never negative. */
export function upgradePriceCents(paidCents: number, target: Plan): number {
  return Math.max(0, target.price_cents - paidCents);
}

/** True once 80% of the album's photos are used (the host is warned). */
export function photosNearlyFull(s: Pick<PlanStatus, "photos" | "photoCap">): boolean {
  return s.photoCap !== null && s.photos >= Math.ceil(s.photoCap * 0.8);
}

/** "ok", "near" (80% of photos used, or ≤7 days left) or "full". */
export function planMood(s: PlanStatus): "ok" | "near" | "full" {
  if (s.photoCap !== null && s.photos >= s.photoCap) return "full";
  if (photosNearlyFull(s)) return "near";
  if (s.daysLeft !== null && s.daysLeft <= 7) return "near";
  return "ok";
}

/** "R149", "R0" — whole rands, prices are stored in cents. */
export function formatRand(cents: number): string {
  const rands = cents / 100;
  return `R${Number.isInteger(rands) ? rands.toLocaleString("en-ZA") : rands.toFixed(2)}`;
}

/** True once the album is past its deletion date. */
export function isExpired(expiresAt: string | null, now = Date.now()): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now;
}
