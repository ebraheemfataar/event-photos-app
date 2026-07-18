"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRCodeCard({ guestUrl }: { guestUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!guestUrl) return;
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-[220px] w-[220px] items-center justify-center">
        {guestUrl && <QRCodeSVG value={guestUrl} size={220} />}
      </div>
      <p className="break-all text-center text-sm text-zinc-600 dark:text-zinc-400">
        {guestUrl}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!guestUrl}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
