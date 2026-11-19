import imageCompression from "browser-image-compression";
import {
  COMPRESSION_OPTIONS,
  COMPRESSION_WORKER_URL,
  PASSTHROUGH_TYPES,
  THUMB_OPTIONS,
} from "@/lib/compressOptions";

/** Small JPEG for the album grid, or null for GIFs (they stay animated) or
 * if the browser can't make one — the grid then uses the full photo. */
export async function makeThumbnail(file: File): Promise<File | null> {
  if (PASSTHROUGH_TYPES.includes(file.type)) return null;
  try {
    return await imageCompression(file, {
      ...THUMB_OPTIONS,
      useWebWorker: true,
      libURL: new URL(COMPRESSION_WORKER_URL, window.location.origin).href,
    });
  } catch {
    return null;
  }
}

export async function compressImage(file: File): Promise<File> {
  // Animated formats would lose every frame but the first.
  if (PASSTHROUGH_TYPES.includes(file.type)) return file;
  return imageCompression(file, {
    ...COMPRESSION_OPTIONS,
    useWebWorker: true,
    libURL: new URL(COMPRESSION_WORKER_URL, window.location.origin).href,
  });
}
