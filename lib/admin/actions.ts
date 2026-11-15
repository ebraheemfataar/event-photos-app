"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";
import { deleteEventCompletely } from "@/lib/eventCleanup";
import { networkHash } from "@/lib/requestIp";
import { ADMIN_COOKIE, SESSION_SECONDS, adminConfigured, isAdmin, newSessionToken, passwordMatches } from "@/lib/admin/session";

// Admin Server Functions. Like every Server Function these are public POST
// endpoints, so each one re-checks the admin session before doing anything,
// and everything is written to admin_audit (0012_admin.sql).

const LOCKOUT_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

type Result = { ok: true } | { ok: false; error: string };
const NOT_ADMIN: Result = { ok: false, error: "Your admin session has ended. Sign in again." };

async function audit(action: string, eventId: string | null, detail: Record<string, unknown> = {}) {
  await createServiceClient()
    .from("admin_audit")
    .insert({ action, event_id: eventId, detail, ip_hash: await networkHash() });
}

export async function adminLogin(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  if (!adminConfigured()) return { error: "The admin portal isn't set up. Set ADMIN_PASSWORD (12+ characters) on the server." };
  const ip = await networkHash();
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const { count } = await createServiceClient()
    .from("admin_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "login_failed")
    .eq("ip_hash", ip)
    .gte("at", since);
  if ((count ?? 0) >= LOCKOUT_ATTEMPTS) {
    return { error: `Too many wrong passwords. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }

  const attempt = String(form.get("password") ?? "");
  if (!passwordMatches(attempt)) {
    await audit("login_failed", null);
    // A short pause makes guessing slower without bothering a real person.
    await new Promise((r) => setTimeout(r, 400));
    return { error: "That password isn't right." };
  }

  (await cookies()).set(ADMIN_COOKIE, newSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_SECONDS,
  });
  await audit("login", null);
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

export async function adminSetUploads(eventId: string, open: boolean): Promise<Result> {
  if (!(await isAdmin())) return NOT_ADMIN;
  if (!isUuid(eventId)) return { ok: false, error: "Unknown album." };
  const { error } = await createServiceClient().from("events").update({ is_active: Boolean(open) }).eq("id", eventId);
  if (error) return { ok: false, error: "Couldn't update the album." };
  await audit(open ? "uploads_reopened" : "uploads_closed", eventId);
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true };
}

/** Deletes an album for good. The caller must type the album's exact name. */
export async function adminDeleteEvent(eventId: string, typedName: string): Promise<Result> {
  if (!(await isAdmin())) return NOT_ADMIN;
  if (!isUuid(eventId)) return { ok: false, error: "Unknown album." };
  const { data: event } = await createServiceClient().from("events").select("name").eq("id", eventId).maybeSingle<{ name: string }>();
  if (!event) return { ok: false, error: "That album no longer exists." };
  if (String(typedName ?? "").trim() !== event.name.trim()) return { ok: false, error: "Type the album's name exactly to confirm." };

  const result = await deleteEventCompletely(eventId);
  await audit(result.ok ? "album_deleted" : "album_delete_failed", eventId, { name: event.name, files: result.files });
  if (!result.ok) return { ok: false, error: "Some files couldn't be deleted. Try again." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminDeletePhoto(eventId: string, photoId: string): Promise<Result> {
  if (!(await isAdmin())) return NOT_ADMIN;
  if (!isUuid(eventId) || !isUuid(photoId)) return { ok: false, error: "Unknown photo." };
  const supabase = createServiceClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id, storage_path, guest_name")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle<{ id: string; storage_path: string; guest_name: string | null }>();
  if (!photo) return { ok: true }; // already gone
  const { error } = await supabase.from("photos").delete().eq("id", photoId);
  if (error) return { ok: false, error: "Couldn't delete the photo." };
  if (!photo.storage_path.startsWith("https://")) await supabase.storage.from("event-photos").remove([photo.storage_path]);
  await audit("photo_deleted", eventId, { photo_id: photoId, guest_name: photo.guest_name });
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true };
}
