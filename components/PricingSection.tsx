import type { AddOn, Plan } from "@/lib/plans";
import { formatRand } from "@/lib/plans";
import { CheckIcon } from "@/components/icons";
import PlanChooseButton from "@/components/PlanChooseButton";

// Landing-page pricing (docs/PRICING.md: "a pricing section on the landing
// page"). Numbers come from the `plans` / `add_ons` tables, so this always
// matches the host's "Your plan" sheet. Paid plans say
// "Coming soon" until payments are switched on; then "Choose" picks
// the plan in the create form (checkout follows on the host page).


function retention(days: number | null) {
  if (days === null) return "Kept forever";
  if (days % 365 === 0) return days === 365 ? "Kept for 1 year" : `Kept for ${days / 365} years`;
  return `Kept for ${days} days`;
}

export default function PricingSection({
  plans,
  addOns,
  paymentsEnabled = false,
}: {
  plans: Plan[];
  addOns: AddOn[];
  /** PayFast configured: paid plans get "Choose" (picks it in the create form). */
  paymentsEnabled?: boolean;
}) {
  if (plans.length === 0) return null;
  const featured = "medium";

  return (
    <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-4 pt-12 md:px-10 md:pt-20">
      <div className="mono px-1.5 text-[11px] text-ink-3">Pricing</div>
      <h2 className="hd mt-2 px-1.5 text-[34px] leading-[1.02] md:text-[56px] md:leading-none">
        Pay once per event. <span className="text-mute">Or nothing at all.</span>
      </h2>
      <p className="mt-3 mb-[18px] max-w-xl px-1.5 text-[15px] leading-normal text-ink-2 md:mb-7 md:text-base">
        Every album starts free. Bigger celebrations get room for more photos and keep them for longer. No subscription.
      </p>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {plans.map((p) => {
          const isFree = p.price_cents === 0;
          const isFeatured = p.id === featured;
          const features = [
            p.max_photos === null ? "No photo limit" : `Up to ${p.max_photos.toLocaleString("en-GB")} photos`,
            retention(p.retention_days),
            p.shows_badge ? "Small Snap & Share badge" : "No Snap & Share badge",
            "Unlimited guests and viewing, live album, QR card",
          ];
          return (
            <li
              key={p.id}
              className={`relative flex flex-col rounded-[24px] border p-5 md:rounded-[28px] md:p-6 ${
                isFeatured ? "border-ink bg-surface shadow-2" : "border-line bg-surface"
              }`}
            >
              {isFeatured && (
                <span className="mono absolute right-4 top-4 rounded-full bg-btn px-2 py-1 text-[9px] text-btn-ink">Weddings</span>
              )}
              <div className="text-lg font-semibold tracking-[-0.02em]">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{isFree ? "R0" : formatRand(p.price_cents)}</span>
                <span className="text-sm text-ink-3">{isFree ? "forever" : "once-off"}</span>
              </div>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-[14px] leading-snug">
                {features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink">
                      <CheckIcon size={11} strokeWidth={3} />
                    </span>
                    <span className="text-ink-2">{f}</span>
                  </li>
                ))}
              </ul>
              {isFree ? (
                <a
                  href="#create"
                  className="mt-6 flex h-12 items-center justify-center rounded-full bg-btn text-[15px] font-semibold text-btn-ink transition-opacity hover:opacity-90"
                >
                  Start free
                </a>
              ) : paymentsEnabled ? (
                <PlanChooseButton planId={p.id} label={`Choose ${p.name}`} />
              ) : (
                <span className="mt-6 flex h-12 items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink-3">
                  Coming soon
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-1 px-1.5 text-[13px] leading-normal text-ink-3 md:flex-row md:justify-between">
        {addOns.length > 0 && (
          <span>
            Need a bit more?{" "}
            {addOns.map((a, i) => (
              <span key={a.id}>
                {i > 0 && " · "}
                <span className="font-semibold text-ink-2">{a.name}</span> {formatRand(a.price_cents)}
              </span>
            ))}
          </span>
        )}
        <span>Every photo counts, the host&apos;s too. Invite as many guests as you like. Prices in rand.</span>
      </div>
    </section>
  );
}
