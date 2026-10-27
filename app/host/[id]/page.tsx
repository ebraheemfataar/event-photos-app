import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getEvent, getEventPhotos, isUuid } from "@/lib/data";
import PhotoGallery from "@/components/PhotoGallery";

export default async function HostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const event = await getEvent(id);
  if (!event) notFound();

  // The token is checked in the database (is_event_host, 0003) and never read
  // back. Skip the call for anything that isn't a uuid.
  let isHost = false;
  if (isUuid(t)) {
    const { data } = await createServiceClient().rpc("is_event_host", {
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

  const photos = await getEventPhotos(event.id);

  return (
    <PhotoGallery
      eventId={event.id}
      initialPhotos={photos}
      eventName={event.name}
      isActive={event.is_active}
      createdAt={event.created_at}
      mode={isHost ? "host" : "viewer"}
      guestUrl={guestUrl}
    />
  );
}
