"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

/** next/image that falls back to the original file if the optimised version
 * fails to load (e.g. an image-optimiser hiccup right after an upload), so a
 * cover or poster never shows as a broken image. */
export default function SafeImage(props: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  const fallback = failedSrc !== null && failedSrc === props.src;
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through in props
    <Image
      {...props}
      unoptimized={fallback || props.unoptimized}
      onError={(e) => {
        if (!fallback) setFailedSrc(props.src);
        props.onError?.(e);
      }}
    />
  );
}
