import type { Metadata } from "next";
import PayDone from "@/components/PayDone";

// Where PayFast sends the buyer back. It never trusts this visit: it shows the
// purchase's status, which only the verified ITN (app/api/payfast/notify) can
// change, and offers the way back to the album.
export const metadata: Metadata = {
  title: "Payment · Snap & Share",
  robots: { index: false, follow: false },
};

export default async function PayDonePage({ searchParams }: { searchParams: Promise<{ p?: string; cancelled?: string }> }) {
  const { p, cancelled } = await searchParams;
  return <PayDone purchaseId={p ?? ""} cancelled={cancelled === "1"} />;
}
