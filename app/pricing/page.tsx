import type { Metadata } from "next";
import Link from "next/link";
import PricingSection from "@/components/PricingSection";
import { getPricing } from "@/lib/data";
import { payfastConfig } from "@/lib/payments/config";
import { LogoIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Pricing · Snap & Share",
  description: "Pay once per event, or nothing at all. Every album starts free.",
};

// Refreshed hourly, like the home page.
export const revalidate = 3600;

const FAQ: [string, string][] = [
  ["What counts towards the limit?", "Every photo in the album, yours included. Invite as many guests as you like: there's no limit on people, and anyone with the link can look for free. A deleted photo frees up its spot."],
  ["Is it a subscription?", "No. You pay once per event. Upgrading later only costs the difference between the plans."],
  ["What happens when the album expires?", "It's deleted, photos and all, on the date shown in your plan. You can keep it longer with an upgrade or the \"Keep 1 more year\" extra before then."],
  ["What if the album fills up?", "Everyone can still see every photo, but nobody can add more (you included) until you upgrade or add +100 photos. You'll get a heads-up when it's 80% full."],
  ["How do I pay?", "Securely through PayFast (card or Instant EFT). We never see or store your card details."],
  ["Can I get a refund?", "See our terms and refund policy."],
];

export default async function PricingPage() {
  const { plans, addOns } = await getPricing();
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="flex h-16 items-center justify-between px-[18px] md:h-[76px] md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={18} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">Snap &amp; Share</span>
        </Link>
        <Link href="/#create" className="inline-flex h-11 items-center rounded-full bg-btn px-5 text-sm font-semibold text-btn-ink">
          Start free
        </Link>
      </header>
      <main className="flex-1 pb-16">
        {plans.length > 0 ? (
          <PricingSection plans={plans} addOns={addOns} paymentsEnabled={payfastConfig() !== null} />
        ) : (
          <p className="px-4 pt-16 text-center text-ink-2">Pricing is loading. Please try again in a moment.</p>
        )}
        <section className="mx-auto max-w-3xl px-4 pt-14 md:px-10">
          <h2 className="hd text-[28px] leading-[1.05] md:text-[36px]">Questions</h2>
          <dl className="mt-5 divide-y divide-line rounded-[22px] border border-line bg-surface">
            {FAQ.map(([q, a]) => (
              <div key={q} className="px-5 py-4">
                <dt className="font-semibold">{q}</dt>
                <dd className="mt-1 text-[15px] leading-normal text-ink-2">
                  {q.startsWith("Can I get") ? (
                    <>
                      See our <Link href="/terms" className="underline">terms and refund policy</Link>.
                    </>
                  ) : (
                    a
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
