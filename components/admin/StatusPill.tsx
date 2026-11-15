import { isExpired } from "@/lib/plans";

/** Live / Closed / Expired, for the admin list and album page. */
export default function StatusPill({ active, expiresAt }: { active: boolean; expiresAt: string | null }) {
  const expired = isExpired(expiresAt);
  const [label, cls] = expired
    ? ["Expired", "bg-danger-bg text-danger"]
    : active
      ? ["Live", "bg-[#22C55E]/15 text-live"]
      : ["Closed", "bg-surface-3 text-ink-2"];
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
