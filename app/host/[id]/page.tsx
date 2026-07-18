import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { Event, Photo } from "@/lib/types";
import QRCodeCard from "@/components/QRCodeCard";
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

  const supabase = createSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, host_token, is_active, created_at")
    .eq("id", id)
    .single<Event>();

  if (!event) notFound();

  const isHost = Boolean(t) && t === event.host_token;

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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {event.name}
        </h1>
        {isHost ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Share this QR code or link with your guests so they can add
            photos.
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Live photo gallery for this event.
          </p>
        )}
      </div>

      {isHost && <QRCodeCard guestUrl={guestUrl} />}

      <div className="flex w-full flex-col items-center gap-4">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Photos
        </h2>
        <PhotoGallery eventId={event.id} initialPhotos={photos ?? []} />
      </div>
    </div>
  );
}
