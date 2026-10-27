import imageCompression from "browser-image-compression";
import {
  COMPRESSION_OPTIONS,
  COMPRESSION_WORKER_URL,
  PASSTHROUGH_TYPES,
} from "@/lib/compressOptions";

export async function compressImage(file: File): Promise<File> {
  // Animated formats would lose every frame but the first.
  if (PASSTHROUGH_TYPES.includes(file.type)) return file;
  return imageCompression(file, {
    ...COMPRESSION_OPTIONS,
    useWebWorker: true,
    libURL: new URL(COMPRESSION_WORKER_URL, window.location.origin).href,
  });
}
