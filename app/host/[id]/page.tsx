import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eventShowsBadge, getAddOns, getAlbumStats, getEvent, getEventPhotos, getPlanStatus, getPlans, isEventHost } from "@/lib/data";
import PhotoGallery from "@/components/PhotoGallery";
import { payfastConfig } from "@/lib/payments/config";

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
  searchParams: Promise<{ t?: string; upgrade?: string }>;
}) {
  const { id } = await params;
  const { t, upgrade } = await searchParams;

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

  const [photos, planStatus, plans, addOns, showBadge, stats] = await Promise.all([
    getEventPhotos(event.id),
    isHost ? getPlanStatus(event) : null,
    isHost ? getPlans() : [],
    isHost ? getAddOns() : [],
    eventShowsBadge(event),
    getAlbumStats(event.id),
  ]);

  return (
    <PhotoGallery
      event={event}
      initialPhotos={photos}
      initialStats={stats}
      mode={isHost ? "host" : "viewer"}
      guestUrl={guestUrl}
      hostToken={isHost ? t : undefined}
      planStatus={planStatus}
      showBadge={showBadge}
      paymentsEnabled={isHost && payfastConfig() !== null}
      initialUpgrade={isHost && typeof upgrade === "string" && /^[a-z_]{1,20}$/.test(upgrade) ? upgrade : null}
      plans={plans}
      addOns={addOns}
    />
  );
}
