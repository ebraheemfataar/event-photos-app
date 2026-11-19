"use client";

import { CHOOSE_PLAN_EVENT } from "@/components/CreateEventForm";

/** "Choose Medium" on a pricing card: picks the plan in the create form and
 * scrolls to it. */
export default function PlanChooseButton({ planId, label }: { planId: string; label: string }) {
  return (
    <a
      href="#create"
      onClick={() => window.dispatchEvent(new CustomEvent(CHOOSE_PLAN_EVENT, { detail: planId }))}
      className="mt-6 flex h-12 items-center justify-center rounded-full border border-line-strong text-[15px] font-semibold transition-colors hover:bg-surface-3"
    >
      {label}
    </a>
  );
}
