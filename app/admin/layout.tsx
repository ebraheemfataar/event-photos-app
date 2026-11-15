import type { Metadata } from "next";

// Developer/operator portal. Never linked from the app, never indexed.
export const metadata: Metadata = {
  title: "Admin · Snap & Share",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-bg text-ink">{children}</div>;
}
