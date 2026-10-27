import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Uploaded photos: served from the private bucket by
    // app/photos/[photoId]/route.ts (no query string allowed).
    localPatterns: [{ pathname: "/photos/**", search: "" }],
    remotePatterns: [
      // Mock photos for /demo, the landing page and the local seed (lib/demoPhotos.ts).
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
        search: "?auto=format&fit=crop&w=1600&q=80",
      },
    ],
  },
};

export default nextConfig;
