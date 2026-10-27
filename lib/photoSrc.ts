import type { Photo } from "@/lib/types";

/** Image URL for a photo. Uploads are served by app/photos/[photoId]/route.ts
 * (the bucket is private); demo/seed rows store a full https URL. */
export function photoSrc(photo: Pick<Photo, "id" | "storage_path">): string {
  return photo.storage_path.startsWith("https://") ? photo.storage_path : `/photos/${photo.id}`;
}
