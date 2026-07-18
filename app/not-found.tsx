import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Event not found
      </h1>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        This event link doesn&apos;t exist or is no longer active. Double
        check the link, or create a new event.
      </p>
      <Link
        href="/"
        className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Create an event
      </Link>
    </div>
  );
}
