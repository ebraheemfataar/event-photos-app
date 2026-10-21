import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { Event, Photo } from "@/lib/types";
import PhotoGallery from "@/components/PhotoGallery";

export default async function GuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = createSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, is_active, created_at")
    .eq("id", id)
    .single<Event>();

  if (!event || !event.is_active) notFound();

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
      mode="guest"
    />
  );
}
