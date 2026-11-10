/** The one loading indicator for anything in progress (uploads, saves,
 * creating, removing). Inherits the text colour; decorative, so pair it with
 * text such as "Uploading…" that says what's happening. */
export default function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`spinner shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
