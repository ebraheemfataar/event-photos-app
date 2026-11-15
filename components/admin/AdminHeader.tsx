import Link from "next/link";
import { adminLogout } from "@/lib/admin/actions";
import { LogoIcon } from "@/components/icons";

export default function AdminHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={16} />
          </span>
          <span className="font-semibold tracking-[-0.02em]">Snap &amp; Share</span>
          <span className="mono rounded-full bg-surface-3 px-2 py-1 text-[10px] text-ink-2">Admin</span>
        </Link>
        <form action={adminLogout} className="ml-auto">
          <button type="submit" className="h-10 rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-surface-3">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
