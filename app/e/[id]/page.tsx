import { notFound } from "next/navigation";
import { getEvent, getEventPhotos } from "@/lib/data";
import PhotoGallery from "@/components/PhotoGallery";

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
      eventId={event.id}
      initialPhotos={photos}
      eventName={event.name}
      isActive={event.is_active}
      createdAt={event.created_at}
      mode="guest"
    />
  );
}
