"use client";

import { createPortal } from "react-dom";
import type { PurchaseDetails } from "@/lib/checkoutActions";
import { formatRand } from "@/lib/plans";

/** Print-only A4 receipt for a paid purchase ("Download receipt" on the
 * payment page opens the print dialog, where "Save as PDF" downloads it).
 * Rendered into <body> as a .print-root, like TableTent: hidden on screen,
 * the only thing printed. Black on white whatever the theme. */
export default function PrintReceipt({ purchaseId, details }: { purchaseId: string; details: PurchaseDetails }) {
  const paid = details.paidAt ?? details.createdAt;
  const date = new Date(paid).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const row = "flex justify-between gap-6 border-b border-[#e5e5e5] py-[3mm]";
  return createPortal(
    <div className="print-root" aria-hidden="true">
      <div style={{ padding: "20mm 18mm", color: "#111", background: "#fff", fontSize: "11pt", lineHeight: 1.45 }}>
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontSize: "16pt", fontWeight: 700, letterSpacing: "-0.02em" }}>Snap &amp; Share</div>
            <div style={{ color: "#666", fontSize: "9.5pt" }}>Event photo albums</div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: "22pt", fontWeight: 700, letterSpacing: "-0.02em" }}>Receipt</div>
            <div style={{ color: "#666", fontSize: "9.5pt" }}>Paid · {date}</div>
          </div>
        </div>

        <div style={{ marginTop: "12mm" }}>
          <div className={row}>
            <span style={{ color: "#666" }}>Receipt number</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "9.5pt" }}>{purchaseId}</span>
          </div>
          {details.providerRef && (
            <div className={row}>
              <span style={{ color: "#666" }}>PayFast reference</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "9.5pt" }}>{details.providerRef}</span>
            </div>
          )}
          {details.event && (
            <div className={row}>
              <span style={{ color: "#666" }}>Album</span>
              <span>{details.event.name}</span>
            </div>
          )}
          {details.emailHint && (
            <div className={row}>
              <span style={{ color: "#666" }}>Receipt to</span>
              <span>{details.emailHint}</span>
            </div>
          )}
          <div className={row}>
            <span style={{ color: "#666" }}>Payment method</span>
            <span>PayFast</span>
          </div>
        </div>

        <table style={{ width: "100%", marginTop: "12mm", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "0.4mm solid #111", textAlign: "left", fontSize: "9.5pt", color: "#666" }}>
              <th style={{ padding: "2mm 0", fontWeight: 600 }}>Item</th>
              <th style={{ padding: "2mm 0", fontWeight: 600, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "0.2mm solid #e5e5e5" }}>
              <td style={{ padding: "3mm 0" }}>
                {details.label}
                <div style={{ color: "#666", fontSize: "9.5pt" }}>Once-off{details.event ? ` · for “${details.event.name}”` : ""}</div>
              </td>
              <td style={{ padding: "3mm 0", textAlign: "right" }}>{formatRand(details.amountCents)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: "4mm 0", fontWeight: 700 }}>Total paid</td>
              <td style={{ padding: "4mm 0", fontWeight: 700, fontSize: "14pt", textAlign: "right" }}>{formatRand(details.amountCents)}</td>
            </tr>
          </tfoot>
        </table>

        <p style={{ marginTop: "14mm", color: "#666", fontSize: "9pt" }}>
          Amounts in South African rand (ZAR). Snap &amp; Share is not registered for VAT, so no VAT is charged and this is not a
          tax invoice. Refunds: see the Terms &amp; refunds on our website. Keep this receipt number if you contact us about this payment.
        </p>
      </div>
    </div>,
    document.body
  );
}
