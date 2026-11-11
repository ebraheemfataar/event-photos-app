// Phase 2c upload rules, kept import-free so tests can check them directly.
// Enforced on the server in lib/uploadActions.ts.

/** Per browser (guest id), per rolling hour. A busy guest posting a whole
 * camera roll in one go is ~30–40 photos. */
export const GUEST_UPLOADS_PER_HOUR = 50;

/** Per network (salted IP hash), per rolling hour. Venue Wi-Fi puts many
 * guests behind one IP, so this is deliberately much higher. */
export const NETWORK_UPLOADS_PER_HOUR = 400;

/** Whole-album safety cap until plans (Monetisation A/B) set real limits. */
export const ALBUM_MAX_PHOTOS = 3000;

/** A started upload must be finished within this time. */
export const TICKET_TTL_MS = 60 * 60 * 1000;

export const MAX_GUEST_NAME = 60;

/** Allowed upload types → stored file extension. Matches the bucket's
 * allowed_mime_types (0005 / 0006). */
export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** What the file's first bytes say it is, or null if it isn't an image we
 * accept. Storage trusts the declared type; this checks the real bytes. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  return null;
}

/** HEIC and HEIF are the same container; either declared type is fine. */
export function typesMatch(declared: string, sniffed: string): boolean {
  const family = (t: string) => (t === "image/heif" ? "image/heic" : t);
  return family(declared) === family(sniffed);
}
