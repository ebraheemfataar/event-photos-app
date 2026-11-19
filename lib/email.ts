import "server-only";
import type { EmailMessage } from "@/lib/emailTemplates";

// Outgoing email (receipts now; expiry reminders next). Sends through
// Resend's HTTP API with plain fetch (no package) when RESEND_API_KEY and
// EMAIL_FROM are set; otherwise does nothing, so nothing breaks before the
// account exists. Setting it up is on the roadmap (docs/ROADMAP.md → Email).
// Templates and previews: lib/emailTemplates.ts, /admin/emails.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, message: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
