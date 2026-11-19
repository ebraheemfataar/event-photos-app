"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getPurchaseDetails, type PurchaseDetails } from "@/lib/checkoutActions";
import { useMyAlbums } from "@/lib/myAlbums";
import { formatRand } from "@/lib/plans";
import Spinner from "@/components/Spinner";
import { LogoIcon } from "@/components/icons";

type View = PurchaseDetails["status"] | "loading" | "unknown";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** After PayFast: waits for the verified confirmation (every 2 s, up to a
 * minute), shows what was bought and what changed, and links straight back
 * to the album — found in this browser's saved albums, so the host link
 * never travels through PayFast. */
export default function PayDone({ purchaseId, cancelled }: { purchaseId: string; cancelled: boolean }) {
  const [details, setDetails] = useState<PurchaseDetails | null>(null);
  const [view, setView] = useState<View>("loading");
  const [gaveUp, setGaveUp] = useState(false);
  const [copied, setCopied] = useState(false);
  const saved = useMyAlbums();
  const tabReturn = useSyncExternalStore(noop, readTabReturn, () => null);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    async function check() {
      const r = await getPurchaseDetails(purchaseId).catch(() => null);
      if (!alive) return;
      if (!r) return setView("unknown");
      setDetails(r);
      setView(r.status);
      if (r.status === "pending" && !cancelled && ++tries < 30) setTimeout(check, 2000);
      else if (r.status === "pending" && !cancelled) setGaveUp(true);
    }
    check();
    return () => {
      alive = false;
    };
  }, [purchaseId, cancelled]);

  // Way back to the album: the saved host link for this album, else the tab's.
  const savedAlbum = details?.event ? saved.find((a) => a.id === details.event!.id) : undefined;
  const back = savedAlbum ? `/host/${savedAlbum.id}?t=${savedAlbum.token}` : (tabReturn ?? null);

  const shown: View = cancelled && view === "pending" ? "cancelled" : view;
  const tone =
    shown === "paid" ? "bg-[#22C55E]/15 text-live" : shown === "failed" || shown === "unknown" ? "bg-danger-bg text-danger" : "bg-surface-3 text-ink-2";
  const [title, sub] =
    shown === "paid"
      ? ["Payment successful", details?.event ? `${details.label} is now on “${details.event.name}”.` : `${details?.label ?? "Your purchase"} is active.`]
      : shown === "cancelled"
        ? ["Payment cancelled", "Nothing was charged and your album is just as it was."]
        : shown === "failed"
          ? ["Payment didn't go through", "Nothing changed on your album. You can try again from “Your plan”."]
          : shown === "unknown"
            ? ["We can't find that payment", "Check the link, or contact us with your PayFast reference if you were charged."]
            : gaveUp
              ? ["Still waiting for PayFast", "This can take a few minutes. Your album updates by itself once PayFast confirms. You can leave this page."]
              : ["Confirming your payment…", "Waiting for PayFast to confirm. This usually takes a few seconds."];

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(purchaseId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const ev = details?.event;
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="flex h-16 items-center px-[18px] md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={18} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">Snap &amp; Share</span>
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-16 pt-4">
        <section className="rounded-[28px] border border-line bg-surface p-6 text-center shadow-2">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${tone}`}>
            {shown === "paid" ? (
              <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            ) : (shown === "pending" && !gaveUp) || shown === "loading" ? (
              <Spinner size={26} />
            ) : shown === "cancelled" ? (
              "↩︎"
            ) : (
              "!"
            )}
          </span>
          <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
          <p role="status" className="mt-2 text-[15px] leading-normal text-ink-2">
            {sub}
          </p>
          {details && (
            <div className="mt-5 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatRand(details.amountCents)}</div>
          )}
          {details && <div className="mt-1 text-sm text-ink-3">{details.label} · once-off</div>}
        </section>

        {details && (
          <section className="rounded-[24px] border border-line bg-surface">
            <dl className="divide-y divide-line text-sm">
              {ev && <Row label="Album" value={ev.name} />}
              <Row label="Purchase" value={details.label} />
              <Row label="Amount" value={formatRand(details.amountCents)} />
              <Row label={details.paidAt ? "Paid on" : "Started"} value={fmtDate(details.paidAt ?? details.createdAt)} />
              <Row
                label="Status"
                value={
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
                    {shown === "paid" ? "Paid" : shown === "cancelled" ? "Cancelled" : shown === "failed" ? "Failed" : "Waiting for PayFast"}
                  </span>
                }
              />
              {details.providerRef && <Row label="PayFast reference" value={<span className="font-mono text-xs">{details.providerRef}</span>} />}
              <Row
                label="Our reference"
                value={
                  <button type="button" onClick={copyRef} className="font-mono text-xs underline decoration-dotted" title="Copy">
                    {copied ? "Copied ✓" : `${purchaseId.slice(0, 8)}…`}
                  </button>
                }
              />
              {details.emailHint && <Row label="Receipt to" value={details.emailHint} />}
            </dl>
          </section>
        )}

        {shown === "paid" && ev && (
          <section className="rounded-[24px] bg-surface-2 p-5">
            <div className="mono text-[11px] text-ink-3">What&apos;s new on your album</div>
            <ul className="mt-3 flex flex-col gap-2.5 text-[15px]">
              <li className="flex gap-2.5">
                <span aria-hidden="true">✦</span>
                <span>
                  <strong>{ev.planName} plan</strong>
                </span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true">✦</span>
                <span>{ev.contributorCap === null ? "No guest limit" : `Up to ${ev.contributorCap.toLocaleString("en-GB")} guests can share`}</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true">✦</span>
                <span>{ev.expiresAt ? `Kept until ${fmtDay(ev.expiresAt)}` : "Kept forever"}</span>
              </li>
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-2">
          {back ? (
            <Link
              href={back}
              className="flex h-14 items-center justify-center rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90"
            >
              {ev ? `Back to ${ev.name}` : "Back to your album"}
            </Link>
          ) : (
            <Link
              href="/#your-albums"
              className="flex h-14 items-center justify-center rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90"
            >
              Find your album
            </Link>
          )}
          <Link href="/terms#refunds" className="flex h-11 items-center justify-center text-sm font-semibold text-ink-3 hover:text-ink">
            Terms &amp; refunds
          </Link>
        </div>
        {!back && (
          <p className="text-center text-xs leading-normal text-ink-3">
            Open your private host link to see your album. If you opened it on this device, it&apos;s under “Your albums” on the home page.
          </p>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

const noop = () => () => {};

function readTabReturn(): string | null {
  try {
    const saved = sessionStorage.getItem("snap-checkout-return");
    return saved?.startsWith("/host/") ? saved : null;
  } catch {
    return null;
  }
}
