import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvent, getEventPhotos } from "@/lib/data";
import { formatEventDate } from "@/lib/eventDetails";
import PhotoGallery from "@/components/PhotoGallery";

// Title/description for the link preview (the card image is
// opengraph-image.tsx). Albums are private-by-link, so never indexed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  const robots = { index: false, follow: false };
  if (!event || !event.is_active) return { title: "Album not found · Snap & Share", robots };
  const description =
    [formatEventDate(event.event_date), event.note || "Add your photos to the shared album: no app, no login."]
      .filter(Boolean)
      .join(" · ");
  const title = `${event.name} · Snap & Share`;
  return { title, description, robots, openGraph: { title, description, type: "website" } };
}

export default async function GuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEvent(id);
  if (!event || !event.is_active) notFound();

  const photos = await getEventPhotos(event.id);

  return (
    <PhotoGallery
      event={event}
      initialPhotos={photos}
      mode="guest"
    />
  );
}
