import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getEvent, getEventPhotos, isEventHost } from "@/lib/data";
import PhotoGallery from "@/components/PhotoGallery";

// Host links carry the token: keep them out of search engines.
export const metadata: Metadata = {
  title: "Your album · Snap & Share",
  robots: { index: false, follow: false },
};

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
  // back; non-uuids are rejected without a call.
  const isHost = await isEventHost(event.id, t);

  const headersList = await headers();
  const host = headersList.get("host");
  const isLocalHost = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const protocol =
    headersList.get("x-forwarded-proto") ?? (isLocalHost ? "http" : "https");
  const guestUrl = host ? `${protocol}://${host}/e/${event.id}` : "";

  const photos = await getEventPhotos(event.id);

  return (
    <PhotoGallery
      event={event}
      initialPhotos={photos}
      mode={isHost ? "host" : "viewer"}
      guestUrl={guestUrl}
      hostToken={isHost ? t : undefined}
    />
  );
}
