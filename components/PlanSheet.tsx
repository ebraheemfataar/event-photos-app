"use client";

import type { Plan, PlanStatus } from "@/lib/plans";
import { formatRand } from "@/lib/plans";
import Sheet from "@/components/Sheet";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** One-line summary for the profile chip: "Free · 12/20 guests · 18 days left". */
export function planSummary(s: PlanStatus): string {
  const guests = s.contributorCap === null ? `${s.contributors} guests` : `${s.contributors}/${s.contributorCap} guests`;
  const time = s.legacy ? null : s.daysLeft === null ? "kept forever" : s.daysLeft === 1 ? "1 day left" : `${s.daysLeft} days left`;
  return [s.planName, guests, time].filter(Boolean).join(" · ");
}

/** Host-only chip under the album title; opens the plan sheet. */
export function PlanChip({ status, onClick }: { status: PlanStatus; onClick: () => void }) {
  const full = status.contributorCap !== null && status.contributors >= status.contributorCap;
  const soon = status.daysLeft !== null && status.daysLeft <= 7;
  const warn = full || soon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Plan: ${planSummary(status)}`}
      className={`inline-flex h-8 max-w-full items-center gap-2 rounded-full border pl-2 pr-3 text-[13px] font-medium transition-colors ${
        warn ? "border-warn-line bg-warn-bg text-warn-ink" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-3"
      }`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${warn ? "bg-current" : "bg-accent"}`} />
      <span className="truncate">{planSummary(status)}</span>
      <span aria-hidden="true" className="text-ink-3">
        ›
      </span>
    </button>
  );
}

export default function PlanSheet({
  open,
  onClose,
  status,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  status: PlanStatus;
  plans: Plan[];
}) {
  const current = plans.find((p) => p.id === status.planId);
  const cap = status.contributorCap;
  const guestPct = cap === null ? 0 : Math.min(100, Math.round((status.contributors / cap) * 100));
  const retention = current?.retention_days ?? null;
  const timePct =
    status.daysLeft === null || retention === null ? 0 : Math.min(100, Math.max(0, Math.round(((retention - status.daysLeft) / retention) * 100)));

  return (
    <Sheet open={open} onClose={onClose} title="Your plan">
      <div className="flex flex-col gap-4 pb-1">
        <div className="rounded-[22px] border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="hd text-[28px] leading-none">{status.planName}</div>
            <div className="text-sm text-ink-2">
              {current && current.price_cents > 0 ? `${formatRand(current.price_cents)} · once-off` : "Free"}
            </div>
          </div>

          <Meter
            label="Guests who've shared"
            value={cap === null ? `${status.contributors} · no limit` : `${status.contributors} of ${cap}`}
            pct={guestPct}
            warn={cap !== null && status.contributors >= cap}
            show={cap !== null}
          />
          <Meter label="Photos" value={String(status.photos)} pct={0} show={false} />
          {status.legacy ? (
            <p className="mt-4 text-[13px] leading-snug text-ink-2">
              This album was made before plans existed: <strong className="font-semibold">no guest limit</strong>, and it&apos;s kept at
              least 90 days after pricing launches.
            </p>
          ) : (
            <Meter
              label="Album kept"
              value={
                status.expiresAt === null
                  ? "Forever"
                  : `Until ${dateFmt(status.expiresAt)} · ${status.daysLeft === 1 ? "1 day" : `${status.daysLeft} days`} left`
              }
              pct={timePct}
              warn={status.daysLeft !== null && status.daysLeft <= 7}
              show={status.expiresAt !== null}
            />
          )}
        </div>

        <div>
          <div className="mono mb-2 text-[11px] text-ink-3">Plans · per event, once-off</div>
          <ul className="flex flex-col gap-2">
            {plans.map((p) => {
              const isCurrent = p.id === status.planId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 ${
                    isCurrent ? "border-ink bg-surface" : "border-line bg-surface"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-semibold">
                      {p.name}
                      {isCurrent && (
                        <span className="mono rounded-full bg-btn px-2 py-0.5 text-[9px] text-btn-ink">Current</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-3">
                      {p.max_contributors === null ? "Unlimited guests" : `Up to ${p.max_contributors} guests`} ·{" "}
                      {p.retention_days === null ? "kept forever" : `kept ${retentionLabel(p.retention_days)}`}
                      {p.shows_badge ? "" : " · no badge"}
                    </div>
                  </div>
                  <div className="shrink-0 text-[15px] font-semibold">{p.price_cents === 0 ? "Free" : formatRand(p.price_cents)}</div>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          disabled
          className="flex h-14 items-center justify-center rounded-full bg-btn text-base font-semibold text-btn-ink opacity-50"
        >
          Upgrades coming soon
        </button>
        <p className="text-center text-xs leading-snug text-ink-3">
          Guests = phones that have added a photo. You never count, and viewing is always unlimited.
        </p>
      </div>
    </Sheet>
  );
}

function retentionLabel(days: number) {
  if (days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`;
  return `${days} days`;
}

function Meter({ label, value, pct, warn = false, show }: { label: string; value: string; pct: number; warn?: boolean; show: boolean }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-2">{label}</span>
        <span className={`text-right font-semibold ${warn ? "text-danger" : ""}`}>{value}</span>
      </div>
      {show && (
        <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-surface-3">
          <div
            className={`h-full rounded-full ${warn ? "bg-danger" : "bg-accent"}`}
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </div>
      )}
    </div>
  );
}
