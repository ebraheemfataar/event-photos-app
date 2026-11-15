"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/** Bottom sheet on mobile, centred card on desktop. Escape / backdrop closes. */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned under the scrolling content (e.g. the main action). */
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus], button")?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([type="file"]):not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/45" />
      {/* Header and footer stay put; only the middle scrolls. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-bg md:max-w-md md:rounded-[28px] md:border md:border-line"
      >
        <div className="shrink-0 px-4 pt-2 md:px-5">
          <div aria-hidden="true" className="mx-auto h-[5px] w-10 rounded-full bg-line-strong md:hidden" />
          <div className="flex h-[52px] items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-ink"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>
        <div
          className={`no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 md:px-5 ${
            footer ? "pb-5" : "pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6"
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-5 md:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
