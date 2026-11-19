"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";
import { eventImageSrc } from "@/lib/eventDetails";
import { isExpired } from "@/lib/plans";
import type { Event } from "@/lib/types";

// "Your albums on this device" (Phase 7a). The browser sends the albums it
// remembered (id + host token); only those whose token really matches are
// returned. Tokens are bearer secrets the browser already holds, so this
// reveals nothing new — and nothing at all for a wrong token.

export type MyAlbumSummary = {
  id: string;
  name: string;
  status: "live" | "closed" | "expired";
  createdAt: string;
  eventDate: string | null;
  cover: string | null;
  photos: number;
};

const MAX = 50;

export async function getMyAlbums(entries: { id: string; token: string }[]): Promise<MyAlbumSummary[]> {
  const wanted = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && isUuid(e.id) && isUuid(e.token))
    .slice(0, MAX);
  if (wanted.length === 0) return [];

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, host_token, is_active, expires_at, created_at, event_date, cover_path, poster_path")
    .in(
      "id",
      wanted.map((e) => e.id)
    );
  const tokenFor = new Map(wanted.map((e) => [e.id, e.token]));
  type Row = Pick<Event, "id" | "name" | "is_active" | "expires_at" | "created_at" | "event_date" | "cover_path" | "poster_path"> & {
    host_token: string;
  };
  const mine = ((data as Row[] | null) ?? []).filter((e) => tokenFor.get(e.id) === e.host_token);

  const counts = await Promise.all(
    mine.map(async (e) => {
      const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("event_id", e.id);
      return count ?? 0;
    })
  );

  return mine.map((e, i) => ({
    id: e.id,
    name: e.name,
    status: isExpired(e.expires_at) ? "expired" : e.is_active ? "live" : "closed",
    createdAt: e.created_at,
    eventDate: e.event_date,
    cover: eventImageSrc(e, "cover"),
    photos: counts[i],
  }));
}
