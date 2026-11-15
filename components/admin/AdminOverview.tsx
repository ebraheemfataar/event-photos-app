"use client";

import { useState, type ReactNode } from "react";
import { OVERVIEW_COOKIE } from "@/lib/admin/query";

/** The "Overview" heading with a Hide / Show toggle for the cards. The choice
 * is kept in a cookie (scoped to /admin) so the server renders it right away. */
export default function AdminOverview({ initiallyHidden, children }: { initiallyHidden: boolean; children: ReactNode }) {
  const [hidden, setHidden] = useState(initiallyHidden);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    document.cookie = `${OVERVIEW_COOKIE}=${next ? "hidden" : "shown"}; path=/admin; max-age=31536000; samesite=strict`;
  }

  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 id="overview-title" className="text-3xl font-semibold tracking-[-0.03em]">
            Overview
          </h1>
          {!hidden && <p className="mt-1 text-sm text-ink-3">Everything on Snap &amp; Share, right now.</p>}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!hidden}
          aria-controls="overview-cards"
          className="flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-3"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${hidden ? "" : "rotate-180"}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      <div id="overview-cards" hidden={hidden}>
        {children}
      </div>
    </section>
  );
}
