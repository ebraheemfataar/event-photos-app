// Plan maths (Monetisation Stage A). The numbers themselves come from the
// `plans` / `add_ons` tables (0011_plans.sql) via lib/data.ts; this file only
// combines them, so it's import-free and unit-tested in tests/plans.spec.ts.

export type Plan = {
  id: string;
  name: string;
  price_cents: number;
  max_contributors: number | null; // null = no limit
  retention_days: number | null; // null = forever
  shows_badge: boolean;
  sort_order: number;
};

export type PlanStatus = {
  planId: string;
  planName: string;
  photos: number;
  contributors: number;
  /** null = no limit (Unlimited plan, or an event from before pricing). */
  contributorCap: number | null;
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
  event: { plan: string; expires_at: string | null; extra_contributors: number; legacy_uncapped: boolean },
  plan: Plan,
  usage: { photos: number; contributors: number },
  now = Date.now()
): PlanStatus {
  const cap = event.legacy_uncapped || plan.max_contributors === null ? null : plan.max_contributors + event.extra_contributors;
  const expiresAt = event.expires_at;
  const daysLeft = expiresAt === null ? null : Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / DAY));
  return {
    planId: plan.id,
    planName: plan.name,
    photos: usage.photos,
    contributors: usage.contributors,
    contributorCap: cap,
    expiresAt,
    daysLeft,
    legacy: event.legacy_uncapped,
    showsBadge: plan.shows_badge,
  };
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
