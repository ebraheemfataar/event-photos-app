import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { Event, Photo } from "@/lib/types";
import PhotoGallery from "@/components/PhotoGallery";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const supabase = createSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, is_active, created_at")
    .eq("id", id)
    .single<Event>();

  if (!event) notFound();

  // The token is checked in the database (0003_lock_down_host_token.sql) and
  // never read back. Skip the call for anything that isn't a uuid, which
  // Postgres would reject anyway.
  let isHost = false;
  if (t && UUID_RE.test(t)) {
    const { data } = await supabase.rpc("is_event_host", {
      p_event_id: event.id,
      p_host_token: t,
    });
    isHost = data === true;
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const isLocalHost = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const protocol =
    headersList.get("x-forwarded-proto") ?? (isLocalHost ? "http" : "https");
  const guestUrl = host ? `${protocol}://${host}/e/${event.id}` : "";

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .returns<Photo[]>();

  return (
    <PhotoGallery
      eventId={event.id}
      initialPhotos={photos ?? []}
      eventName={event.name}
      isActive={event.is_active}
      createdAt={event.created_at}
      mode={isHost ? "host" : "viewer"}
      guestUrl={guestUrl}
    />
  );
}
