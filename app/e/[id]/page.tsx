import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { Event, Photo } from "@/lib/types";
import PhotoUploadForm from "@/components/PhotoUploadForm";
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
    .select("id, name, host_token, is_active, created_at")
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {event.name}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Take or upload a photo to add it to the shared album.
        </p>
      </div>

      <PhotoUploadForm eventId={event.id} />

      <div className="flex w-full flex-col items-center gap-4">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Photos
        </h2>
        <PhotoGallery eventId={event.id} initialPhotos={photos ?? []} />
      </div>
    </div>
  );
}
