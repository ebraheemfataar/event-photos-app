import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { tokenValid } from "@/lib/admin/token";

// Admin sign-in (docs/ROADMAP.md → Admin portal, option A): one password in
// the ADMIN_PASSWORD env var. A correct password sets a signed, httpOnly
// cookie scoped to /admin for 12 hours (token logic in lib/admin/token.ts).

export { adminConfigured, passwordMatches, newSessionToken, SESSION_SECONDS } from "@/lib/admin/token";

export const ADMIN_COOKIE = "snap_admin";

export async function isAdmin(): Promise<boolean> {
  return tokenValid((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** Use at the top of every admin page. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
