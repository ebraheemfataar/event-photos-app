import type { Photo } from "@/lib/types";

/** Image URL for a photo. Uploads are served by app/photos/[photoId]/route.ts
 * (the bucket is private); demo/seed rows store a full https URL. */
export function photoSrc(photo: Pick<Photo, "id" | "storage_path">): string {
  return photo.storage_path.startsWith("https://") ? photo.storage_path : `/photos/${photo.id}`;
}

/** Grid-sized version: the uploaded thumbnail when there is one (0014),
 * otherwise the full photo (left to next/image to resize). */
export function thumbSrc(photo: Pick<Photo, "id" | "storage_path" | "thumb_path">): { src: string; isThumb: boolean } {
  if (photo.thumb_path && !photo.storage_path.startsWith("https://")) return { src: `/photos/${photo.id}/thumb`, isThumb: true };
  return { src: photoSrc(photo), isThumb: false };
}
