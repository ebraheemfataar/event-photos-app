import type { Metadata } from "next";
import { headers } from "next/headers";
import DemoAlbum from "@/components/DemoAlbum";
import { demoPhotos } from "@/lib/demoPhotos";

export const metadata: Metadata = {
  title: "Demo album · Snap & Share",
};

// /demo = guest view, /demo?as=host = host view, /demo?empty=1 = empty album.
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; empty?: string }>;
}) {
  const { as, empty } = await searchParams;

  const headersList = await headers();
  const host = headersList.get("host");
  const isLocalHost = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const protocol = headersList.get("x-forwarded-proto") ?? (isLocalHost ? "http" : "https");
  const guestUrl = host ? `${protocol}://${host}/demo` : "";

  return (
    <DemoAlbum
      photos={empty ? [] : demoPhotos()}
      mode={as === "host" ? "host" : "guest"}
      guestUrl={guestUrl}
    />
  );
}
