import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Mock photos for /demo, the landing page and the local seed (lib/demoPhotos.ts).
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
        search: "?auto=format&fit=crop&w=1600&q=80",
      },
      // Local Supabase stack (`npm run db:start`) — dev only.
      ...(isDev
        ? [
            {
              protocol: "http" as const,
              hostname: "127.0.0.1",
              port: "54321",
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
    // Next 16 refuses to optimise images from local IPs; allow it only in dev
    // so uploads to the local storage bucket render.
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
