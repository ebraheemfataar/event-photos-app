"use server";

import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { isEventHost, isUuid } from "@/lib/data";
import { validateDetails, type DetailsInput, type EventImageKind } from "@/lib/eventDetails";

// Host-only writes for event details (0008_event_details.sql). Server
// Functions are public POST endpoints, so EVERY function here first checks
// the host token against the event in the database (is_event_host) and only
// then writes with the service-role key. Inputs are re-validated here; the
// browser's validation is just for quick feedback.

type Failure = { ok: false; error: string };
type Result = { ok: true } | Failure;

const NOT_HOST: Failure = { ok: false, error: "Only the host can change this. Open your private host link." };
const KINDS: EventImageKind[] = ["cover", "poster"];
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function saveEventDetails(eventId: string, hostToken: string, input: DetailsInput): Promise<Result> {
  if (!(await isEventHost(eventId, hostToken))) return NOT_HOST;
  const checked = validateDetails(input);
  if (!checked.ok) return checked;
  const { error } = await createServiceClient().from("events").update(checked.value).eq("id", eventId);
  return error ? { ok: false, error: "Couldn't save. Try again." } : { ok: true };
}

/** Step 1 of a cover/poster upload: a one-time signed upload URL for a new,
 * unguessable path in the event's private `_event/` folder. */
export async function startEventImageUpload(
  eventId: string,
  hostToken: string,
  kind: EventImageKind,
  contentType: string
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  if (!(await isEventHost(eventId, hostToken))) return NOT_HOST;
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown image type." };
  const ext = IMAGE_TYPES[contentType];
  if (!ext) return { ok: false, error: "Use a JPG, PNG, WebP or GIF image." };
  const path = `${eventId}/_event/${kind}-${randomUUID()}.${ext}`;
  const { data, error } = await createServiceClient().storage.from("event-photos").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Try again." };
  return { ok: true, path, token: data.token };
}

/** Step 2: point the event at the uploaded file and delete the old one. */
export async function finishEventImageUpload(
  eventId: string,
  hostToken: string,
  kind: EventImageKind,
  path: string
): Promise<Result> {
  if (!(await isEventHost(eventId, hostToken))) return NOT_HOST;
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown image type." };
  const file = String(path).split("/").pop() ?? "";
  const expected = new RegExp(
    `^${eventId}/_event/${kind}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|gif)$`
  );
  if (!isUuid(eventId) || !expected.test(path)) return { ok: false, error: "That upload doesn't belong to this event." };

  const supabase = createServiceClient();
  // The file must really be there (the signed upload actually happened).
  const { data: found } = await supabase.storage.from("event-photos").list(`${eventId}/_event`, { search: file });
  if (!found?.some((o) => o.name === file)) return { ok: false, error: "The upload didn't finish. Try again." };

  return setImageColumn(eventId, kind, path);
}

export async function removeEventImage(eventId: string, hostToken: string, kind: EventImageKind): Promise<Result> {
  if (!(await isEventHost(eventId, hostToken))) return NOT_HOST;
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown image type." };
  return setImageColumn(eventId, kind, null);
}

async function setImageColumn(eventId: string, kind: EventImageKind, path: string | null): Promise<Result> {
  const supabase = createServiceClient();
  const column = kind === "cover" ? "cover_path" : "poster_path";
  const { data: before } = await supabase.from("events").select(column).eq("id", eventId).maybeSingle();
  const { error } = await supabase.from("events").update({ [column]: path }).eq("id", eventId);
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  const old = (before as Record<string, string | null> | null)?.[column];
  if (old && old !== path && old.startsWith(`${eventId}/_event/`)) {
    await supabase.storage.from("event-photos").remove([old]);
  }
  return { ok: true };
}
