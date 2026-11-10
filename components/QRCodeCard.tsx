"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import TableTent from "@/components/TableTent";
import { ArrowRightIcon, DownloadIcon, LinkIcon, PrinterIcon, ShareIcon } from "@/components/icons";

/** The printable "table card". Its colours come from the event theme's
 * --card-* variables, which stay light in dark mode (it gets printed). */
export function TableCard({
  eventName,
  guestUrl,
  size = 196,
}: {
  eventName: string;
  guestUrl: string;
  size?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[22px] border border-line bg-[var(--card-bg)] text-center text-[var(--card-ink)] shadow-2">
      <div className="px-5 pb-4 pt-5">
        <div className="mono text-[10px] text-[var(--card-muted)]">Scan to add your photos</div>
        <div className="hd mt-1.5 text-[26px] leading-[1.05] break-words">{eventName}</div>
        <div className="mx-auto mt-3 flex items-center justify-center" style={{ width: size, height: size }}>
          {guestUrl && (
            <QRCodeSVG
              value={guestUrl}
              size={size}
              fgColor="currentColor"
              bgColor="transparent"
              role="img"
              aria-label="QR code for the guest upload link"
            />
          )}
        </div>
      </div>
      <div className="flex h-10 items-center justify-center bg-[var(--card-strip)] text-[13px] font-semibold text-[var(--card-strip-ink)]">
        No app · No login · Just scan
      </div>
    </div>
  );
}

/** Table card + Copy guest link / Download QR / Share. */
export default function QRCodeCard({
  eventName,
  guestUrl,
  onNotify,
  split = false,
}: {
  eventName: string;
  guestUrl: string;
  onNotify: (message: string) => void;
  /** Side-by-side card + actions from md up (host page). */
  split?: boolean;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  // Each click bumps `n`; the tent is mounted (print-only) and printed once
  // its fonts are ready. `theme` is read from the album at click time.
  const [tent, setTent] = useState<{ n: number; theme: string } | null>(null);

  useEffect(() => {
    if (!tent) return;
    let cancelled = false;
    // Unmount after printing, so only one tent is ever in the page.
    const done = () => setTent(null);
    window.addEventListener("afterprint", done, { once: true });
    document.fonts.ready.then(() => {
      if (!cancelled) requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", done);
    };
  }, [tent]);

  function handlePrint() {
    const theme = canvasWrapRef.current?.closest("[data-theme]")?.getAttribute("data-theme") ?? "classic";
    setTent((t) => ({ n: (t?.n ?? 0) + 1, theme }));
  }

  async function handleCopy() {
    if (!guestUrl) return;
    try {
      await navigator.clipboard.writeText(guestUrl);
      onNotify("Guest link copied");
    } catch {
      onNotify("Couldn't copy — long-press the link instead");
    }
  }

  async function handleShare() {
    if (!guestUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: eventName, text: `Add your photos to ${eventName}`, url: guestUrl });
      } catch {
        // User cancelled the share sheet.
      }
      return;
    }
    await handleCopy();
  }

  async function handleDownload() {
    const wrap = canvasWrapRef.current;
    const qr = wrap?.querySelector("canvas");
    if (!wrap || !qr) return;
    // Compose a print-ready PNG of the table card in the event's theme.
    const W = 900;
    const H = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const style = getComputedStyle(wrap);
    const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    const bodyFamily = getComputedStyle(document.body).fontFamily;
    const titleFamily = v("--font-display", bodyFamily);
    const titleWeight = v("--hd-weight", "500");
    // Make sure a theme's serif heading font is loaded before drawing with it.
    await document.fonts.load(`${titleWeight} 72px ${titleFamily}`).catch(() => {});

    ctx.fillStyle = v("--card-bg", "#FFFFFF");
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = v("--card-muted", "#55555B");
    ctx.textAlign = "center";
    ctx.font = `500 28px ${bodyFamily}`;
    ctx.fillText("SCAN TO ADD YOUR PHOTOS", W / 2, 110);

    ctx.fillStyle = v("--card-ink", "#0E0E10");
    ctx.font = `${titleWeight} 72px ${titleFamily}`;
    const words = eventName.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > W - 120 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 2);
    shown.forEach((l, i) => ctx.fillText(l, W / 2, 210 + i * 80));

    const qrSize = 600;
    const qrTop = 210 + shown.length * 80;
    ctx.drawImage(qr, (W - qrSize) / 2, qrTop, qrSize, qrSize);

    ctx.fillStyle = v("--card-strip", "#FF5A1F");
    ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = v("--card-strip-ink", "#0E0E10");
    ctx.font = `600 36px ${bodyFamily}`;
    ctx.fillText("No app · No login · Just scan", W / 2, H - 48);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}-qr.png`;
    a.click();
  }

  return (
    <div className={`flex flex-col gap-4 ${split ? "md:flex-row md:items-center md:gap-8" : ""}`}>
      <div className={split ? "md:w-[300px] md:shrink-0" : ""}>
        <TableCard eventName={eventName} guestUrl={guestUrl} />
      </div>
      <div ref={canvasWrapRef} className="hidden" aria-hidden="true">
        {guestUrl && <QRCodeCanvas value={guestUrl} size={600} marginSize={0} bgColor="transparent" />}
      </div>
      <div className={`flex flex-col gap-2 ${split ? "md:min-w-0 md:flex-1" : ""}`}>
        {split && (
          <div className="mb-2 hidden md:block">
            <div className="mono text-[11px] text-ink-3">Guest QR</div>
            <h2 className="hd mt-1.5 text-[34px] leading-[1.02]">
              Print it for the tables. <span className="text-mute">Or drop the link in the group chat.</span>
            </h2>
            {guestUrl && <p className="mono mt-3 break-all text-[11px] normal-case text-ink-3">{guestUrl}</p>}
          </div>
        )}
        <button
          type="button"
          onClick={handleCopy}
          disabled={!guestUrl}
          className="flex h-14 items-center justify-between rounded-full bg-btn pl-[22px] pr-2 text-base font-semibold text-btn-ink transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            <LinkIcon size={17} />
            Copy guest link
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">
            <ArrowRightIcon size={18} />
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!guestUrl}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3 disabled:opacity-50"
          >
            <DownloadIcon size={17} />
            Download QR
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!guestUrl}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-[15px] font-semibold transition-colors hover:bg-surface-3 disabled:opacity-50"
          >
            <ShareIcon size={17} />
            Share
          </button>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!guestUrl}
          className="flex min-h-[52px] items-center gap-3 rounded-[20px] border border-dashed border-line-strong px-4 py-2.5 text-left transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          <PrinterIcon size={20} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Print table card</span>
            <span className="block text-xs text-ink-3">A4 · fold in half and stand it on each table</span>
          </span>
        </button>
      </div>
      {tent && guestUrl && <TableTent key={tent.n} eventName={eventName} guestUrl={guestUrl} theme={tent.theme} />}
    </div>
  );
}
