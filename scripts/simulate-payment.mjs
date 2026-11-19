// LOCAL ONLY: plays PayFast's part after a sandbox checkout. PayFast can't
// reach localhost to send its ITN, so this signs one with the sandbox
// passphrase from .env.development.local and posts it to the local app.
// The app only accepts it because PAYFAST_SKIP_REMOTE_CHECKS=true locally.
//
// Usage:  npm run pay:simulate            → newest pending purchase, COMPLETE
//         npm run pay:simulate -- <purchase id> [CANCELLED|FAILED]

import fs from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.development.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
if (!env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1")) {
  console.error("This only runs against the local stack (npm run db:env).");
  process.exit(1);
}

const [idArg, statusArg] = process.argv.slice(2);
const status = (statusArg ?? "COMPLETE").toUpperCase();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let query = db.from("event_purchases").select("id, amount_cents, status, kind, item, event_id");
query = idArg ? query.eq("id", idArg) : query.eq("status", "pending").order("created_at", { ascending: false }).limit(1);
const { data } = await query;
const purchase = data?.[0];
if (!purchase) {
  console.error(idArg ? `No purchase ${idArg}.` : "No pending purchase. Start a checkout first (plan sheet → Continue to payment).");
  process.exit(1);
}

const enc = (v) =>
  encodeURIComponent(v)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
const fields = [
  ["m_payment_id", purchase.id],
  ["pf_payment_id", String(Date.now())],
  ["payment_status", status],
  ["item_name", "Snap & Share (simulated)"],
  ["amount_gross", (purchase.amount_cents / 100).toFixed(2)],
  ["merchant_id", env.PAYFAST_MERCHANT_ID],
];
const base = fields.map(([k, v]) => `${k}=${enc(v)}`).join("&");
const signature = createHash("md5")
  .update(env.PAYFAST_PASSPHRASE ? `${base}&passphrase=${enc(env.PAYFAST_PASSPHRASE)}` : base)
  .digest("hex");

const res = await fetch("http://localhost:3000/api/payfast/notify", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `${base}&signature=${signature}`,
});
console.log(`${status} for ${purchase.kind} "${purchase.item}" (R${(purchase.amount_cents / 100).toFixed(2)}) → ${res.status} ${await res.text()}`);
console.log(`Return page: http://localhost:3000/pay/done?p=${purchase.id}`);
