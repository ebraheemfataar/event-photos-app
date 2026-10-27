// Settings for browser-image-compression, kept in their own import-free file
// so tests/exif.spec.ts can run the library with exactly these options.
//
// Privacy: the library always redraws the image on a canvas and re-encodes it,
// which drops all EXIF metadata (GPS location, camera model, timestamps).
// It only copies EXIF back when `preserveExif` is true — never set it.

/** Self-hosted copy of the library for its web worker. Without this the
 * worker downloads the library from cdn.jsdelivr.net at upload time.
 * Must match the installed version (pinned exactly in package.json). */
export const COMPRESSION_WORKER_URL = "/vendor/browser-image-compression@2.0.2.js";

export const COMPRESSION_OPTIONS = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 1920,
  preserveExif: false,
} as const;

/** Uploaded as-is, without compression. Redrawing a GIF on a canvas keeps
 * only its first frame, which kills the animation. GIFs have no EXIF block,
 * so skipping compression doesn't leak location data. */
export const PASSTHROUGH_TYPES: readonly string[] = ["image/gif"];

/** Matches the event-photos bucket's file_size_limit (0005 / 0006). Only
 * passthrough files can realistically hit it; compressed ones target ~1.2 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** File extension for the uploaded object, from its real content type (the
 * compressor can change the type, e.g. HEIC → PNG). */
export function extensionFor(type: string, fallbackName: string): string {
  return EXTENSIONS[type] ?? (fallbackName.split(".").pop() || "jpg").toLowerCase();
}
