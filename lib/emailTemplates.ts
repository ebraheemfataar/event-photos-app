// Email templates (receipt, expiry reminder). Import-free so the admin preview
// page (/admin/emails) and the senders share them. Each returns a subject, a
// plain-text body and a simple, inline-styled HTML body that works in mail
// apps. Sending is wired in lib/email.ts and switched on with Resend later
// (docs/ROADMAP.md → Email).

export type EmailMessage = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const rand = (cents: number) => `R${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function layout(title: string, intro: string, rows: [string, string][], footer: string, cta?: { label: string; href: string }): string {
  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;color:#74747A;font-size:14px;border-top:1px solid #ECECE8">${esc(k)}</td><td style="padding:10px 0;text-align:right;font-size:14px;font-weight:600;border-top:1px solid #ECECE8">${esc(v)}</td></tr>`
    )
    .join("");
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#0E0E10;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:999px">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F4F2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0E0E10">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-weight:600;font-size:15px"><span style="display:inline-block;width:26px;height:26px;border-radius:50%;background:#0E0E10;vertical-align:middle;margin-right:8px"></span>Snap &amp; Share</p>
<h1 style="margin:0;font-size:24px;line-height:1.2;letter-spacing:-0.02em">${esc(title)}</h1>
<p style="margin:10px 0 18px;font-size:15px;line-height:1.5;color:#4A4A50">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table>
${button}
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#74747A">${esc(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function receiptEmail(d: {
  albumName: string;
  label: string;
  amountCents: number;
  paidAt: string;
  providerRef: string | null;
  purchaseId: string;
  whatsNew: string[];
}): EmailMessage {
  const subject = `Your Snap & Share receipt: ${d.label}`;
  const rows: [string, string][] = [
    ["Album", d.albumName],
    ["Purchase", d.label],
    ["Amount paid", rand(d.amountCents)],
    ["Date", day(d.paidAt)],
    ...(d.providerRef ? ([["PayFast reference", d.providerRef]] as [string, string][]) : []),
    ["Our reference", d.purchaseId.slice(0, 8)],
  ];
  const intro = `Thanks! ${d.label} is now on “${d.albumName}”. ${d.whatsNew.join(" · ")}.`;
  const footer =
    "Paid once, no subscription. Payments are processed by PayFast; we never see your card details. Questions or refunds: reply to this email. Open your album with your private host link.";
  const text = [subject, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", footer].join("\n");
  return { subject, text, html: layout("Payment received", intro, rows, footer) };
}

export function expiryReminderEmail(d: {
  albumName: string;
  expiresAt: string;
  daysLeft: number;
  photos: number;
  hostUrl: string;
}): EmailMessage {
  const when = d.daysLeft <= 1 ? "tomorrow" : `in ${d.daysLeft} days`;
  const subject = `“${d.albumName}” will be deleted ${when}`;
  const intro = `Your album and all ${d.photos.toLocaleString("en-GB")} photos will be permanently deleted on ${day(d.expiresAt)}. Download the photos you want to keep, or keep the album longer with an upgrade or “Keep for 1 more year”.`;
  const rows: [string, string][] = [
    ["Album", d.albumName],
    ["Photos", d.photos.toLocaleString("en-GB")],
    ["Deleted on", day(d.expiresAt)],
  ];
  const footer = "You're getting this because you bought a plan for this album. Deleted albums can't be recovered.";
  const text = [subject, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `Open your album: ${d.hostUrl}`, "", footer].join("\n");
  return { subject, text, html: layout(`Deleted ${when}`, intro, rows, footer, { label: "Open your album", href: d.hostUrl }) };
}
