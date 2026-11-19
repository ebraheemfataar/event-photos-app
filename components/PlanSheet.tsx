"use client";

import { useState } from "react";
import type { AddOn, Plan, PlanStatus } from "@/lib/plans";
import { formatRand, planMood, upgradePriceCents } from "@/lib/plans";
import Sheet from "@/components/Sheet";
import Spinner from "@/components/Spinner";
import { startCheckout } from "@/lib/checkoutActions";

// "Your plan" sheet, from the design in docs/design (snap-share-your-plan.html):
// usage first (big number, bar, two stat tiles), plans second (tap one to
// see the upgrade price = new plan − what's been paid), extras, fine print.
// With payments switched on (PayFast configured on the server), picking a
// plan or extra and an email starts checkout; otherwise the button says
// "Upgrades coming soon". The plan only changes after PayFast's verified
// notification (app/api/payfast/notify), never from this page.

const HEADING = { fontFamily: "var(--font-title, var(--font-geist-sans), system-ui, sans-serif)" } as const;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const n = (v: number) => v.toLocaleString("en-GB");

/** One-line summary for the profile chip. */
export function planSummary(s: PlanStatus): string {
  if (s.legacy) return "Early album · no limit";
  if (s.contributorCap === null && s.expiresAt === null) return `${s.planName} · kept forever`;
  const guests = s.contributorCap === null ? `${s.contributors} guests` : `${s.contributors}/${s.contributorCap} guests`;
  const time =
    s.expiresAt === null
      ? "kept forever"
      : s.priceCents > 0
        ? `kept to ${shortDate(s.expiresAt)}`
        : s.daysLeft === 1
          ? "1 day left"
          : `${s.daysLeft} days left`;
  return [s.planName, guests, time].join(" · ");
}

/** Short usage line for the host sidebar: "4/20 guests · 26 days left". */
export function planUsageLine(s: PlanStatus): string {
  if (s.legacy) return "Early album · no limit";
  const guests = s.contributorCap === null ? `${s.contributors} guests` : `${s.contributors}/${s.contributorCap} guests`;
  const time = s.expiresAt === null ? "kept forever" : s.daysLeft === 1 ? "1 day left" : `${s.daysLeft} days left`;
  return `${guests} · ${time}`;
}

/** Host-only plan card under the album profile: plan, usage, a guests bar
 * and a clear Upgrade button. Opens the plan sheet. */
export function PlanCard({ status, onOpen, isTopPlan }: { status: PlanStatus; onOpen: () => void; isTopPlan: boolean }) {
  const mood = planMood(status);
  const cap = status.contributorCap;
  const pct = cap ? Math.min(100, (status.contributors / cap) * 100) : 0;
  const frame =
    mood === "full" ? "border-danger/40 bg-danger-bg" : mood === "near" ? "border-warn-line bg-warn-bg" : "border-line bg-surface";
  const bar = mood === "full" ? "bg-danger" : mood === "near" ? "bg-warn-ink" : "bg-accent";
  return (
    <section aria-label="Your plan" className={`flex items-center gap-3 rounded-[22px] border p-3.5 lg:p-4 ${frame}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-btn text-btn-ink">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5z" />
          <path d="M14 5v14" strokeDasharray="2 2.5" />
        </svg>
      </span>
      <button type="button" onClick={onOpen} aria-label={`Plan: ${planSummary(status)}`} className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-semibold">
          {status.legacy ? "Early album" : `${status.planName} plan`}
          {mood === "full" && <span className="ml-1.5 text-xs font-semibold text-danger">· Full</span>}
        </span>
        <span className={`block truncate text-[13px] ${mood === "ok" ? "text-ink-3" : "text-warn-ink"}`}>{planSummary(status).split(" · ").slice(1).join(" · ")}</span>
        {cap !== null && (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-3">
            <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90 ${
          isTopPlan ? "border border-line-strong bg-surface text-ink" : "bg-accent text-accent-ink"
        }`}
      >
        {isTopPlan ? "Manage" : "Upgrade"}
      </button>
    </section>
  );
}

export default function PlanSheet({
  open,
  onClose,
  status,
  plans,
  addOns,
  paymentsEnabled = false,
  eventId,
  hostToken,
  initialSelected = null,
}: {
  open: boolean;
  onClose: () => void;
  status: PlanStatus;
  plans: Plan[];
  addOns: AddOn[];
  /** PayFast is configured: show real checkout. */
  paymentsEnabled?: boolean;
  eventId?: string;
  hostToken?: string;
  /** Plan to pre-select (e.g. chosen when the album was created). */
  initialSelected?: string | null;
}) {
  const UPGRADES_LIVE = paymentsEnabled && Boolean(eventId && hostToken);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [selectedAddOn, setSelectedAddOn] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const mood = planMood(status);
  const rank = (id: string) => plans.findIndex((p) => p.id === id);
  const isUnlimited = !status.legacy && status.contributorCap === null && status.expiresAt === null;
  const options = status.legacy ? plans.filter((p) => p.price_cents > 0) : plans.filter((p) => rank(p.id) >= rank(status.planId));
  const next = options.find((p) => p.id !== status.planId && (!status.legacy || p.price_cents > 0));
  const target = plans.find((p) => p.id === selected) ?? null;
  const targetAddOn = addOns.find((a) => a.id === selectedAddOn) ?? null;
  const choice = target
    ? { kind: "plan" as const, id: target.id }
    : targetAddOn
      ? { kind: "add_on" as const, id: targetAddOn.id }
      : null;
  const payAmount = target ? upgradePriceCents(status.priceCents, target) : (targetAddOn?.price_cents ?? 0);

  function close() {
    setSelected(null);
    setSelectedAddOn(null);
    setPayError(null);
    onClose();
  }

  function pickPlan(id: string | null) {
    setSelected(id);
    if (id) setSelectedAddOn(null);
  }

  /** Start checkout and hand the browser to PayFast. */
  async function pay() {
    if (!choice || !eventId || !hostToken) return;
    setPaying(true);
    setPayError(null);
    const r = await startCheckout({ eventId, hostToken, item: choice, email });
    if (!r.ok) {
      setPaying(false);
      setPayError(r.error);
      return;
    }
    // The return page brings you back here without the host link ever going
    // to PayFast: remember where we were, for this tab only.
    try {
      sessionStorage.setItem("snap-checkout-return", window.location.pathname + window.location.search);
    } catch {}
    const form = document.createElement("form");
    form.method = "POST";
    form.action = r.action;
    for (const [k, v] of r.fields) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = v;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  const footer =
    (choice || mood !== "ok") && !isUnlimited ? (
          <div className="flex flex-col gap-2 text-center">
            {choice ? (
              UPGRADES_LIVE ? (
                <>
                  <label className="flex h-12 items-center gap-2.5 rounded-[14px] border border-line-strong bg-surface-2 px-4 text-left focus-within:border-ink">
                    <span className="whitespace-nowrap text-sm text-ink-3">Receipt to</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-label="Email for your receipt"
                      className="h-full min-w-0 flex-1 bg-transparent text-right text-base outline-none focus-visible:[box-shadow:none]"
                    />
                  </label>
                  {payError && (
                    <p role="alert" className="rounded-[12px] bg-danger-bg px-3 py-2 text-left text-[13px] text-danger">
                      {payError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={pay}
                    disabled={paying}
                    aria-busy={paying}
                    className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90"
                  >
                    {paying && <Spinner />}
                    {paying ? "Opening PayFast…" : `Continue to payment · ${formatRand(payAmount)}`}
                  </button>
                  <span className="text-[12.5px] text-ink-3">
                    Secure payment with PayFast ·{" "}
                    <a href="/terms" target="_blank" className="underline">
                      Terms &amp; refunds
                    </a>
                  </span>
                </>
              ) : (
                <>
                  <button type="button" disabled className="h-[54px] w-full cursor-not-allowed rounded-full bg-surface-2 text-base font-semibold text-ink-3">
                    Upgrades coming soon
                  </button>
                  <span className="text-[12.5px] text-ink-3">Your album stays exactly as it is until then.</span>
                </>
              )
            ) : (
              next && (
                <button
                  type="button"
                  onClick={() => pickPlan(next.id)}
                  className="h-[54px] w-full rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90"
                >
                  Upgrade to {next.name} · {formatRand(upgradePriceCents(status.priceCents, next))}
                </button>
              )
            )}
          </div>
    ) : null;

  return (
    <Sheet open={open} onClose={close} title="Your plan" footer={footer}>
      <div className="flex flex-col gap-[22px]">
        {isUnlimited ? <UnlimitedCard status={status} /> : status.legacy ? <LegacyCard status={status} /> : <UsageCard status={status} />}

        {mood === "near" && status.contributorCap !== null && !status.legacy && (
          <Nudge tone="warn" title={nearTitle(status)}>
            {next
              ? `Once ${status.contributorCap} guests have shared, new guests can look but can’t add photos. ${next.name} makes room for ${next.max_contributors === null ? "everyone" : next.max_contributors} and keeps everything ${next.retention_days === null ? "forever" : `for ${retention(next.retention_days)}`}.`
              : "Upgrade to keep it longer."}
          </Nudge>
        )}
        {mood === "full" && (
          <Nudge tone="full" title="Your album is full">
            {UPGRADES_LIVE
              ? "New guests can still see every photo, but can’t add their own. Upgrade and they can start sharing straight away."
              : "New guests can still see every photo. When plans go live, you’ll need to upgrade for new guests to add their own."}
          </Nudge>
        )}

        {!isUnlimited && options.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between px-1">
              <span className="mono text-[11px] text-ink-3">{status.legacy ? "Keep it longer" : "Plans"}</span>
              <span className="mono text-[11px] text-ink-3">Pay once per event</span>
            </div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Plans">
              {options.map((p) => {
                const sub = `${p.max_contributors === null ? "Unlimited guests" : `Up to ${p.max_contributors} guests`} · ${
                  p.retention_days === null ? "Kept forever" : `Kept ${retention(p.retention_days)}`
                }${p.shows_badge ? "" : " · no badge"}`;
                if (p.id === status.planId && !status.legacy) {
                  return (
                    <div key={p.id} className="flex flex-col gap-1 rounded-[20px] border-[1.5px] border-dashed border-line-strong px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex items-center gap-2 text-lg font-semibold" style={HEADING}>
                          {p.name}
                          <span className="mono rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2" style={{ fontFamily: "var(--font-mono)" }}>
                            Current
                          </span>
                        </span>
                        <span className="text-base font-semibold tabular-nums">{p.price_cents ? formatRand(p.price_cents) : "Free"}</span>
                      </div>
                      <div className="text-[13px] text-ink-3">{sub}</div>
                    </div>
                  );
                }
                const on = selected === p.id;
                const diff = upgradePriceCents(status.priceCents, p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickPlan(on ? null : p.id)}
                    className={`flex min-h-16 w-full flex-col gap-1 rounded-[20px] border-[1.5px] bg-surface px-4 py-3.5 text-left transition-colors focus-visible:[box-shadow:none] ${
                      on ? "border-accent" : "border-transparent hover:border-line-strong focus-visible:border-ink-3"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2.5">
                      <span className="flex items-center gap-2 text-lg font-semibold" style={HEADING}>
                        <span
                          aria-hidden="true"
                          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                            on ? "border-accent bg-accent" : "border-line-strong"
                          }`}
                        >
                          {on && <span className="h-2 w-2 rounded-full bg-accent-ink" />}
                        </span>
                        {p.name}
                      </span>
                      <span className="text-base font-semibold tabular-nums">{formatRand(p.price_cents)}</span>
                    </span>
                    <span className="text-[13px] text-ink-3">{sub}</span>
                    {on && (
                      <span className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2.5">
                        <b className="text-base">
                          Upgrade to {p.name} · {formatRand(diff)}
                        </b>
                        <span className="text-[13px] text-ink-2">
                          {status.priceCents > 0
                            ? `You’ve paid ${formatRand(status.priceCents)} for ${status.planName}, so you only pay the difference.`
                            : "Paid once for this event. No subscription."}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!isUnlimited && addOns.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="px-1">
              <span className="mono text-[11px] text-ink-3">Extras</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {addOns.map((a) => {
                const body = (
                  <>
                    <b className="text-sm font-semibold leading-snug">{a.name}</b>
                    <span className="text-xs text-ink-3">
                      <span className="font-semibold text-ink-2">{formatRand(a.price_cents)}</span> ·{" "}
                      {a.extra_retention_days > 0 ? "added to your keep date" : a.stackable ? "add as many as you need" : "once per event"}
                    </span>
                  </>
                );
                if (!UPGRADES_LIVE) {
                  return (
                    <div key={a.id} className="flex min-h-14 flex-col gap-0.5 rounded-[18px] bg-surface-2 px-3.5 py-3">
                      {body}
                    </div>
                  );
                }
                const on = selectedAddOn === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setSelectedAddOn(on ? null : a.id);
                      if (!on) setSelected(null);
                    }}
                    className={`flex min-h-14 flex-col gap-0.5 rounded-[18px] border-[1.5px] bg-surface-2 px-3.5 py-3 text-left focus-visible:[box-shadow:none] ${
                      on ? "border-accent" : "border-transparent hover:border-line-strong"
                    }`}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!isUnlimited && (
          <p className="px-1 text-[12.5px] leading-normal text-ink-3">
            Guests are phones that have added at least one photo. You don’t count, and anyone can view.
          </p>
        )}

      </div>
    </Sheet>
  );
}

function UsageCard({ status: s }: { status: PlanStatus }) {
  const cap = s.contributorCap ?? 0;
  const mood = planMood(s);
  const pct = cap ? Math.min(100, (s.contributors / cap) * 100) : 0;
  const left = Math.max(0, cap - s.contributors);
  const barTone = mood === "full" ? "bg-danger" : mood === "near" && left <= Math.max(2, Math.ceil(cap * 0.1)) ? "bg-warn-ink" : "bg-accent";
  return (
    <section className="flex flex-col gap-3.5 rounded-[24px] bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`mono inline-flex h-[26px] items-center rounded-full px-2.5 text-[11px] ${s.priceCents ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink"}`}
        >
          {s.planName} plan
        </span>
        {s.priceCents > 0 && <span className="text-[13px] text-ink-3">Paid {formatRand(s.priceCents)}</span>}
      </div>
      {s.contributorCap !== null ? (
        <>
          <div className="flex items-baseline gap-2 tabular-nums">
            <b className="text-5xl font-semibold leading-none tracking-[-0.03em]">{s.contributors}</b>
            <span className="text-[17px] text-ink-2">of {s.contributorCap} guests</span>
          </div>
          <div role="img" aria-label={`${s.contributors} of ${s.contributorCap} guests`} className="h-2 overflow-hidden rounded-full bg-surface-2">
            <i className={`block h-full rounded-full ${barTone}`} style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <div className={`-mt-1.5 text-sm ${mood === "full" ? "font-medium text-danger" : "text-ink-2"}`}>
            {mood === "full" ? "No spots left" : `${left} ${left === 1 ? "spot" : "spots"} left`}
          </div>
        </>
      ) : (
        <div className="flex items-baseline gap-2 tabular-nums">
          <b className="text-5xl font-semibold leading-none tracking-[-0.03em]">{s.contributors}</b>
          <span className="text-[17px] text-ink-2">guests · no limit</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Stat value={n(s.photos)} label="photos" />
        {s.expiresAt === null ? (
          <Stat value="Forever" label="Kept" />
        ) : s.priceCents > 0 ? (
          <Stat value={shortDate(s.expiresAt)} label="Kept until" />
        ) : (
          <Stat
            value={s.daysLeft === 1 ? "1 day left" : `${s.daysLeft} days left`}
            label={`Deleted on ${shortDate(s.expiresAt)}`}
            warn={s.daysLeft !== null && s.daysLeft <= 7}
          />
        )}
      </div>
    </section>
  );
}

function UnlimitedCard({ status: s }: { status: PlanStatus }) {
  return (
    <section className="relative flex flex-col items-center overflow-hidden rounded-[24px] bg-surface px-5 pb-[22px] pt-[30px] text-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[120px] left-1/2 h-[260px] w-[260px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 28%, transparent), transparent)" }}
      />
      <div aria-hidden="true" className="relative text-[76px] font-light leading-[0.9] text-accent">
        ∞
      </div>
      <h3 className="relative mt-1.5 text-[26px] font-semibold tracking-[-0.01em]" style={HEADING}>
        {s.planName}
      </h3>
      <p className="relative mt-0.5 text-sm text-ink-2">No limits. Kept forever.</p>
      <div className="relative mt-4 grid w-full grid-cols-2 gap-2.5 text-left">
        <Stat value={n(s.contributors)} label="guests have shared" />
        <Stat value={n(s.photos)} label="photos" />
      </div>
    </section>
  );
}

function LegacyCard({ status: s }: { status: PlanStatus }) {
  return (
    <>
      <section className="flex flex-col gap-3.5 rounded-[24px] bg-surface p-5">
        <span className="mono inline-flex h-[26px] items-center self-start rounded-full bg-surface-2 px-2.5 text-[11px] text-ink">Early album</span>
        <div className="flex items-baseline gap-2 tabular-nums">
          <b className="text-5xl font-semibold leading-none tracking-[-0.03em]">{s.contributors}</b>
          <span className="text-[17px] text-ink-2">guests · no limit</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat value={n(s.photos)} label="photos" />
          <Stat value="No countdown" label="Kept at least 90 days after plans launch" />
        </div>
      </section>
      <Nudge tone="info" title="Made before plans existed">
        Your album has no guest limit. Nothing changes until plans launch, and you’ll see it here first.
      </Nudge>
    </>
  );
}

function Stat({ value, label, warn = false }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[18px] bg-surface-2 p-3.5">
      <b className={`text-xl font-semibold tracking-[-0.01em] tabular-nums ${warn ? "text-warn-ink" : ""}`}>{value}</b>
      <span className="text-[13px] leading-snug text-ink-3">{label}</span>
    </div>
  );
}

function Nudge({ tone, title, children }: { tone: "warn" | "full" | "info"; title: string; children: React.ReactNode }) {
  const box = tone === "warn" ? "bg-warn-bg text-warn-ink" : "bg-surface text-ink";
  return (
    <div className={`flex flex-col gap-1 rounded-[22px] px-[18px] py-4 ${box}`}>
      <b className="flex items-center gap-2 text-base">
        {tone === "full" && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
        {title}
      </b>
      <p className={`text-sm leading-[1.45] ${tone === "warn" ? "" : "text-ink-2"}`}>{children}</p>
    </div>
  );
}

/** "Only 2 spots left", or "4 days left" when time is what's running out. */
function nearTitle(s: PlanStatus) {
  const left = s.contributorCap === null ? Infinity : s.contributorCap - s.contributors;
  if (left <= Math.max(2, Math.ceil((s.contributorCap ?? 0) * 0.1))) return `Only ${left} ${left === 1 ? "spot" : "spots"} left`;
  return s.daysLeft === 1 ? "1 day left" : `${s.daysLeft} days left`;
}

function retention(days: number) {
  if (days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`;
  return `${days} days`;
}
