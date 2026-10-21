import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div aria-hidden="true" className="relative h-[150px] w-[140px]">
        <span className="absolute inset-0 -rotate-6 rounded-[18px] border-2 border-dashed border-line-strong bg-surface" />
        <span className="absolute inset-0 flex items-center justify-center text-[40px] text-ink-3">?</span>
      </div>
      <h1 className="hd mt-7 text-[30px] leading-[1.05]">
        We can&apos;t find this album. <br />
        <span className="text-mute">It may have closed.</span>
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-normal text-ink-2">
        The link may be mistyped, or the event is no longer active. Double check the link, or start your own.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-14 items-center rounded-full bg-btn px-6 text-[15px] font-semibold text-btn-ink transition-opacity hover:opacity-90"
      >
        Start your own album
      </Link>
    </div>
  );
}
