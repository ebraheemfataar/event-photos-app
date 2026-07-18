import CreateEventForm from "@/components/CreateEventForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-24 text-center dark:bg-black">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Snap &amp; Share
        </h1>
        <p className="max-w-sm text-base text-zinc-600 dark:text-zinc-400">
          Create a shared photo album for your event. Guests scan a QR code
          and upload straight from their phone — no app, no login.
        </p>
      </div>
      <CreateEventForm />
    </div>
  );
}
