"use client";

import { useRef } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { ArrowRightIcon, DownloadIcon, LinkIcon, ShareIcon } from "@/components/icons";

/** The printable white "table card". Always white, in both themes. */
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
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[22px] border border-line bg-white text-center text-[#0E0E10] shadow-2">
      <div className="px-5 pb-4 pt-5">
        <div className="mono text-[10px] text-[#55555B]">Scan to add your photos</div>
        <div className="hd mt-1.5 text-[26px] leading-[1.05] break-words">{eventName}</div>
        <div className="mx-auto mt-3 flex items-center justify-center" style={{ width: size, height: size }}>
          {guestUrl && (
            <QRCodeSVG
              value={guestUrl}
              size={size}
              fgColor="#0E0E10"
              bgColor="#FFFFFF"
              role="img"
              aria-label="QR code for the guest upload link"
            />
          )}
        </div>
      </div>
      <div className="flex h-10 items-center justify-center bg-[#FF5A1F] text-[13px] font-semibold text-[#0E0E10]">
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

  function handleDownload() {
    const qr = canvasWrapRef.current?.querySelector("canvas");
    if (!qr) return;
    // Compose a print-ready PNG of the table card.
    const W = 900;
    const H = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = getComputedStyle(document.body).fontFamily;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#55555B";
    ctx.textAlign = "center";
    ctx.font = `500 28px ${family}`;
    ctx.fillText("SCAN TO ADD YOUR PHOTOS", W / 2, 110);

    ctx.fillStyle = "#0E0E10";
    ctx.font = `500 72px ${family}`;
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

    ctx.fillStyle = "#FF5A1F";
    ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = "#0E0E10";
    ctx.font = `600 36px ${family}`;
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
        {guestUrl && <QRCodeCanvas value={guestUrl} size={600} marginSize={0} />}
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
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[#0E0E10]">
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
      </div>
    </div>
  );
}
