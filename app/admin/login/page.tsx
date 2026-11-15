import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin/session";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { LogoIcon } from "@/components/icons";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[28px] border border-line bg-surface p-6 shadow-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={18} />
          </span>
          <span className="text-lg font-semibold tracking-[-0.02em]">Snap &amp; Share</span>
          <span className="mono ml-auto rounded-full bg-surface-3 px-2 py-1 text-[10px] text-ink-2">Admin</span>
        </div>
        {adminConfigured() ? (
          <AdminLoginForm />
        ) : (
          <p className="mt-6 rounded-[14px] bg-warn-bg px-3 py-2.5 text-sm text-warn-ink">
            The admin portal is switched off. Set <code>ADMIN_PASSWORD</code> (12+ characters) on the server to turn it on.
          </p>
        )}
      </div>
    </main>
  );
}
