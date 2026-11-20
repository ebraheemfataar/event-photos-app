import { requireAdmin } from "@/lib/admin/session";
import { emailConfigured } from "@/lib/email";
import { expiryReminderEmail, receiptEmail } from "@/lib/emailTemplates";
import AdminHeader from "@/components/admin/AdminHeader";

// Previews of every email the app sends, with sample data. Sending is off
// until Resend is set up (RESEND_API_KEY + EMAIL_FROM).
export default async function AdminEmailsPage() {
  await requireAdmin();
  // Fixed sample dates (previews only).
  const now = "2026-11-20T10:00:00Z";
  const samples = [
    {
      name: "Receipt (after a verified PayFast payment)",
      msg: receiptEmail({
        albumName: "Sam & Alex's Wedding",
        label: "Medium plan",
        amountCents: 39900,
        paidAt: now,
        providerRef: "1987654",
        purchaseId: "041c109c-2d9f-4afe-90d4-0e3b7a60c73d",
        whatsNew: ["Up to 500 photos", "Kept for 1 year"],
      }),
    },
    {
      name: "Expiry reminder: 7 days before",
      msg: expiryReminderEmail({
        albumName: "Sam & Alex's Wedding",
        expiresAt: "2026-11-27T10:00:00Z",
        daysLeft: 7,
        photos: 412,
        hostUrl: "https://example.com/host/…",
      }),
    },
    {
      name: "Expiry reminder: 1 day before",
      msg: expiryReminderEmail({
        albumName: "Sam & Alex's Wedding",
        expiresAt: "2026-11-21T10:00:00Z",
        daysLeft: 1,
        photos: 412,
        hostUrl: "https://example.com/host/…",
      }),
    },
  ];

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Emails</h1>
          <p className="mt-1 text-sm text-ink-3">Every email Snap &amp; Share sends, with sample data.</p>
        </div>
        <p
          role="status"
          className={`rounded-[14px] px-4 py-3 text-sm ${emailConfigured() ? "bg-[#22C55E]/15 text-live" : "border border-warn-line bg-warn-bg text-warn-ink"}`}
        >
          {emailConfigured()
            ? "Sending is ON (Resend)."
            : "Sending is OFF: set RESEND_API_KEY and EMAIL_FROM (a verified domain) to turn it on. Nothing is sent until then."}
        </p>
        <div className="grid gap-6 lg:grid-cols-3">
          {samples.map((s) => (
            <section key={s.name} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{s.name}</h2>
              <div className="rounded-[14px] border border-line bg-surface px-3 py-2 text-xs">
                <span className="text-ink-3">Subject: </span>
                {s.msg.subject}
              </div>
              <iframe title={s.name} srcDoc={s.msg.html} sandbox="" className="h-[560px] w-full rounded-[18px] border border-line bg-white" />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
