"use server";

import { createHash, createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { isEventHost, isUuid } from "@/lib/data";
import { getPromptById } from "@/lib/prompts";
import {
  ALBUM_MAX_PHOTOS,
  GUEST_UPLOADS_PER_HOUR,
  MAX_GUEST_NAME,
  NETWORK_UPLOADS_PER_HOUR,
  TICKET_TTL_MS,
  UPLOAD_TYPES,
  sniffImageType,
  typesMatch,
} from "@/lib/uploadRules";

// Phase 2c: every photo goes through the server (0009 / 0010). Server
// Functions are public POST endpoints, so each one validates everything it's
// given; the guest id is a bearer secret held by one browser, and only its
// hash is ever stored or compared.

type Failure = { ok: false; error: string };

const BUCKET = "event-photos";
const hashGuest = (guestId: string) => createHash("sha256").update(`guest:${guestId}`).digest("hex");

async function networkHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  // Salted with a server secret so stored hashes can't be reversed to IPs.
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local";
  return createHmac("sha256", salt).update(`ip:${ip}`).digest("hex");
}

const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

/** Step 1: check limits, record a ticket, hand back a one-time upload URL. */
export async function startPhotoUpload(input: {
  eventId: string;
  guestId: string;
  contentType: string;
  hostToken?: string;
}): Promise<{ ok: true; photoId: string; path: string; token: string } | Failure> {
  const { eventId, guestId, contentType, hostToken } = input ?? {};
  if (!isUuid(eventId) || !isUuid(guestId)) return { ok: false, error: "Something's off with this upload. Reload and try again." };
  const ext = UPLOAD_TYPES[contentType];
  if (!ext) return { ok: false, error: "Only photos (JPG, PNG, WebP, GIF, HEIC) can be shared." };

  const supabase = createServiceClient();
  const { data: event } = await supabase.from("events").select("id, is_active").eq("id", eventId).maybeSingle();
  if (!event) return { ok: false, error: "This album doesn't exist." };
  if (!event.is_active) return { ok: false, error: "This album is closed to new photos." };

  const byHost = hostToken ? await isEventHost(eventId, hostToken) : false;
  const guestHash = hashGuest(guestId);
  const ipHash = await networkHash();
  const since = hourAgo();

  const count = async (column: string, value: string, sinceIso?: string) => {
    let q = supabase.from("upload_tickets").select("photo_id", { count: "exact", head: true }).eq(column, value);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    const { count: n } = await q;
    return n ?? 0;
  };

  // The host is never rate-limited as a guest (and never counts as one).
  if (!byHost) {
    if ((await count("guest_hash", guestHash, since)) >= GUEST_UPLOADS_PER_HOUR) {
      return { ok: false, error: "You've shared a lot in the last hour. Take a breather and try again a bit later." };
    }
    if ((await count("ip_hash", ipHash, since)) >= NETWORK_UPLOADS_PER_HOUR) {
      return { ok: false, error: "Lots of photos from this network right now. Try again in a few minutes." };
    }
  }
  const { count: albumPhotos } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((albumPhotos ?? 0) >= ALBUM_MAX_PHOTOS) return { ok: false, error: "This album is full." };

  const photoId = randomUUID();
  const path = `${eventId}/${photoId}.${ext}`;
  const { error: ticketError } = await supabase.from("upload_tickets").insert({
    photo_id: photoId,
    event_id: eventId,
    storage_path: path,
    content_type: contentType,
    guest_hash: guestHash,
    ip_hash: ipHash,
    by_host: byHost,
  });
  if (ticketError) return { ok: false, error: "Couldn't start the upload. Try again." };

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Try again." };
  return { ok: true, photoId, path, token: data.token };
}

/** Step 3 (after the browser uploaded the file): check the ticket and the
 * file's real type, then add the photo to the album. */
export async function finishPhotoUpload(input: {
  eventId: string;
  photoId: string;
  guestId: string;
  guestName?: string | null;
  promptId?: string | null;
}): Promise<{ ok: true } | Failure> {
  const { eventId, photoId, guestId } = input ?? {};
  if (!isUuid(eventId) || !isUuid(photoId) || !isUuid(guestId)) return { ok: false, error: "Something's off with this upload." };
  const supabase = createServiceClient();

  const { data: ticket } = await supabase
    .from("upload_tickets")
    .select("photo_id, event_id, storage_path, content_type, guest_hash, by_host, created_at, finished_at")
    .eq("photo_id", photoId)
    .maybeSingle();
  if (
    !ticket ||
    ticket.event_id !== eventId ||
    ticket.guest_hash !== hashGuest(guestId) ||
    ticket.finished_at ||
    Date.now() - new Date(ticket.created_at).getTime() > TICKET_TTL_MS
  ) {
    return { ok: false, error: "That upload expired. Try again." };
  }

  // Read only the first bytes and check it really is the image it claims.
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(ticket.storage_path, 60);
  if (!signed) return { ok: false, error: "The upload didn't finish. Try again." };
  const head = await readHead(signed.signedUrl);
  const sniffed = head ? sniffImageType(head) : null;
  if (!sniffed || !typesMatch(ticket.content_type, sniffed)) {
    await supabase.storage.from(BUCKET).remove([ticket.storage_path]);
    await supabase.from("upload_tickets").update({ finished_at: new Date().toISOString() }).eq("photo_id", photoId);
    return { ok: false, error: "That file isn't a photo we can share." };
  }

  const name = String(input.guestName ?? "").trim().slice(0, MAX_GUEST_NAME) || null;
  const prompt = input.promptId && getPromptById(input.promptId) ? input.promptId : null;

  // Claim the ticket first so a replayed finish can't insert twice.
  const { data: claimed } = await supabase
    .from("upload_tickets")
    .update({ finished_at: new Date().toISOString() })
    .eq("photo_id", photoId)
    .is("finished_at", null)
    .select("photo_id");
  if (!claimed?.length) return { ok: false, error: "That upload expired. Try again." };

  const { error } = await supabase.from("photos").insert({
    id: photoId,
    event_id: eventId,
    storage_path: ticket.storage_path,
    content_type: ticket.content_type,
    guest_name: name,
    prompt_id: prompt,
    guest_hash: ticket.guest_hash,
    by_host: ticket.by_host,
  });
  if (error) {
    // e.g. the album closed in between: don't leave the file behind.
    await supabase.storage.from(BUCKET).remove([ticket.storage_path]);
    return { ok: false, error: "Couldn't add the photo. Try again." };
  }
  return { ok: true };
}

async function readHead(url: string): Promise<Uint8Array | null> {
  try {
    // Storage honours Range, so this is 32 bytes (at worst the whole file,
    // which the bucket caps at 10 MB).
    const res = await fetch(url, {
      headers: { Range: "bytes=0-31" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer()).slice(0, 32);
  } catch {
    return null;
  }
}

/** A guest deletes a photo they uploaded from this browser. */
export async function deleteMyPhoto(input: { eventId: string; photoId: string; guestId: string }): Promise<{ ok: true } | Failure> {
  const { eventId, photoId, guestId } = input ?? {};
  if (!isUuid(eventId) || !isUuid(photoId) || !isUuid(guestId)) return { ok: false, error: "Couldn't delete that photo." };
  const supabase = createServiceClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .eq("guest_hash", hashGuest(guestId))
    .maybeSingle();
  if (!photo) return { ok: false, error: "You can only delete photos you shared from this phone." };
  return removePhotoRow(photo.id, photo.storage_path);
}

/** The host removes any photo (replaces the delete_event_photo RPC so the
 * file itself is deleted through the Storage API, not just its record). */
export async function removePhotoAsHost(input: { eventId: string; photoId: string; hostToken: string }): Promise<{ ok: true } | Failure> {
  const { eventId, photoId, hostToken } = input ?? {};
  if (!isUuid(photoId) || !(await isEventHost(eventId, hostToken))) {
    return { ok: false, error: "Only the host can remove photos. Open your private host link." };
  }
  const { data: photo } = await createServiceClient()
    .from("photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!photo) return { ok: true }; // already gone
  return removePhotoRow(photo.id, photo.storage_path);
}

async function removePhotoRow(id: string, storagePath: string): Promise<{ ok: true } | Failure> {
  const supabase = createServiceClient();
  // Row first: the 0007 trigger tells every open album to drop it.
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete that photo. Try again." };
  // Seed / demo rows point at https URLs, not bucket files.
  if (!storagePath.startsWith("https://")) await supabase.storage.from(BUCKET).remove([storagePath]);
  return { ok: true };
}
