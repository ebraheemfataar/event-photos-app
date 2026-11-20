import type { Metadata } from "next";
import Link from "next/link";
import { LogoIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Terms, refunds & privacy · Snap & Share",
  description: "The terms for using Snap & Share, our refund policy, and how we handle photos and personal information.",
};

// Original terms written for how Snap & Share works (South Africa: Consumer
// Protection Act, ECT Act, POPIA). Have them reviewed before launch.
// Set SUPPORT_EMAIL to the address customers should write to.
const SUPPORT_EMAIL = "";
const UPDATED = "19 November 2026";

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "about",
    title: "1. What Snap & Share is",
    body: (
      <>
        <p>
          Snap &amp; Share lets a host create a shared photo album for an event. Guests open the album with a link or QR code and add photos
          from their phone, without an app or an account. These terms apply to everyone who uses Snap &amp; Share: hosts, guests and
          visitors. By creating or using an album you agree to them.
        </p>
      </>
    ),
  },
  {
    id: "albums",
    title: "2. Albums, links and the host link",
    body: (
      <>
        <p>
          Anyone who has an album&apos;s guest link or QR code can view the album and, while uploads are open, add photos. Share it only with
          people you want in the album.
        </p>
        <p>
          The <strong>host link</strong> gives full control of the album (editing, removing photos, closing uploads, upgrading). Keep it
          private. We can&apos;t tell who is using a host link, so anyone who has it is treated as the host. If you lose it, we may not be
          able to recover it for you.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "3. Your photos",
    body: (
      <>
        <p>
          <strong>You keep ownership of the photos you add.</strong> By adding a photo you give us permission to store it and show it to
          people who have the album&apos;s link, for as long as the album exists. We don&apos;t sell your photos or use them for advertising.
        </p>
        <p>
          Only add photos you have the right to share. Don&apos;t add anything illegal, hateful, sexually explicit, or that harms or exposes
          someone without their consent. The host can remove any photo, and a guest can delete the photos they added from the same phone.
          We may remove content or close an album that breaks these terms or the law.
        </p>
        <p>
          We remove location data (GPS) and other camera details from photos when they&apos;re uploaded. Photos are stored privately and
          only served to people with the link.
        </p>
      </>
    ),
  },
  {
    id: "plans",
    title: "4. Plans and payments",
    body: (
      <>
        <p>
          Every album starts on the Free plan. Paid plans and extras are a <strong>once-off payment per album</strong> (not a subscription),
          in South African rand, with the price shown before you pay. Upgrading later costs only the difference between the plans.
        </p>
        <p>
          Payments are processed by <strong>PayFast</strong>. We never see or store your card or bank details. A plan is applied to your
          album once PayFast confirms the payment, usually within a minute.
        </p>
        <p>
          A plan sets how many photos the album can hold (every photo counts, the host&apos;s included; guests and viewing are unlimited)
          and how long the album is kept. Prices and plans may change for future purchases; they never change for an album you&apos;ve already
          paid for.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "5. Refunds and cancellations",
    body: (
      <>
        <p>
          <strong>7-day cooling-off.</strong> You can cancel a purchase within 7 days of paying for a full refund, as long as no guests have
          added photos to the album since you paid. Once guests start sharing under the upgraded plan, the service has been delivered, so
          the cooling-off right no longer applies.
        </p>
        <p>
          <strong>If something goes wrong on our side</strong> (for example, you were charged but your album wasn&apos;t upgraded, you were
          charged twice, or the service didn&apos;t work as described), we&apos;ll fix it or refund you in full.
        </p>
        <p>
          Refunds go back to the original payment method through PayFast, normally within 7–10 business days. Downgrades aren&apos;t refunded
          as partial amounts, and unused time or photo space isn&apos;t refunded after an event.
        </p>
        <p>To ask for a refund, contact us (below) with your album name and the PayFast reference from your receipt.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "6. How long albums are kept",
    body: (
      <>
        <p>
          Each album is kept for the period of its plan, shown in the host&apos;s &ldquo;Your plan&rdquo; screen. After that date the album,
          its photos and its files are <strong>permanently deleted</strong> and can&apos;t be recovered. Download anything you want to keep
          before then, or extend the album with an upgrade or the &ldquo;Keep for 1 more year&rdquo; extra.
        </p>
        <p>Albums made before plans existed are kept for at least 90 days after paid plans launch.</p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "7. Privacy and personal information",
    body: (
      <>
        <p>We collect as little as possible, and handle it under South Africa&apos;s Protection of Personal Information Act (POPIA):</p>
        <ul>
          <li>
            <strong>Photos and the name you type</strong> (optional), shown in the album.
          </li>
          <li>
            <strong>A random ID stored on your phone</strong>, so you can delete your own photos and so we can stop upload abuse. We only
            keep a scrambled (hashed) version of it.
          </li>
          <li>
            <strong>A scrambled version of your network address</strong>, only to stop abuse (for example, too many uploads at once). We
            never store the address itself.
          </li>
          <li>
            <strong>Your email</strong>, only if you buy a plan, to send your receipt and reminders about your album.
          </li>
        </ul>
        <p>
          We don&apos;t sell personal information, and we only share it with the services that run Snap &amp; Share (hosting, storage,
          PayFast for payments and an email provider for receipts). You can ask us what we hold about you, or to correct or delete it, by
          contacting us. The host can delete the whole album at any time by contacting us, and guests can delete their own photos.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "8. Availability and liability",
    body: (
      <>
        <p>
          We work hard to keep Snap &amp; Share running and your photos safe, but we can&apos;t promise it will always be available or
          error-free. Please keep your own copies of photos that matter to you.
        </p>
        <p>
          To the extent the law allows, our total liability to you for any claim is limited to the amount you paid for the album concerned.
          Nothing in these terms limits rights you have under the Consumer Protection Act that can&apos;t be limited.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "9. Changes and the law",
    body: (
      <>
        <p>
          We may update these terms; the date at the top shows the latest version, and changes don&apos;t affect purchases already made.
          These terms are governed by the laws of South Africa.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="flex h-16 items-center px-[18px] md:h-[76px] md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-btn text-btn-ink">
            <LogoIcon size={18} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">Snap &amp; Share</span>
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <div className="mono text-[11px] text-ink-3">Last updated {UPDATED}</div>
        <h1 className="hd mt-2 text-[40px] leading-[1.02] md:text-[52px]">Terms, refunds &amp; privacy</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
          The short version: your photos stay yours, you pay once per album (or nothing), you can cancel within 7 days before guests start
          sharing, and albums are deleted when their plan ends.
        </p>

        <nav aria-label="On this page" className="mt-8 rounded-[20px] border border-line bg-surface p-4">
          <div className="mono mb-2 text-[10px] text-ink-3">On this page</div>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-2 hover:text-ink hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 flex flex-col gap-10">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="text-xl font-semibold tracking-[-0.01em]">{s.title}</h2>
              <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
                {s.body}
              </div>
            </section>
          ))}

          <section id="contact" className="scroll-mt-6 rounded-[22px] border border-line bg-surface p-5">
            <h2 className="text-xl font-semibold tracking-[-0.01em]">Contact us</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {SUPPORT_EMAIL ? (
                <>
                  Questions, refunds or privacy requests:{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-ink underline">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </>
              ) : (
                <>Questions, refunds or privacy requests: reply to your Snap &amp; Share receipt email, and we&apos;ll get back to you.</>
              )}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
