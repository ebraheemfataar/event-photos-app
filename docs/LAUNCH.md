# Launch day checklist

Everything needed to switch on paid plans for real. Until these are done the
live site is safe: payments are off ("Coming soon"), no guest cap, nothing is
deleted. Related: [PRICING.md](PRICING.md), [ROADMAP.md](ROADMAP.md),
`supabase/launch/pricing-launch.sql`.

## Weeks before

- [ ] **Domain** bought (e.g. a `.co.za`) and pointed at Vercel. Needed for a proper web address and for email.
- [ ] **Email (Resend):** account, verify the domain (DNS records), then `RESEND_API_KEY` + `EMAIL_FROM` (e.g. `receipts@yourdomain.co.za`) on Vercel. Templates are ready: `/admin/emails`. Then wire the 7-day / 1-day expiry reminders into the daily job (`app/api/cron/expire`) — the only email code still to write.
- [ ] **Terms:** set `SUPPORT_EMAIL` in `app/terms/page.tsx`, update `UPDATED`, and have the terms and refund policy reviewed (Consumer Protection Act, ECT Act cooling-off, POPIA).
- [ ] **PayFast live account:** verified and activated; in PayFast → Settings → Developer Settings set a **passphrase**; note the live merchant id / key.
- [ ] **Sandbox dress rehearsal on a Vercel preview:** sandbox `PAYFAST_*` vars on the **Preview** environment only, create a throwaway album, upgrade, "Complete Payment" — it should come back upgraded by itself (real ITN). Delete the album from `/admin` afterwards.
- [ ] **Thumbnails / big albums / migrations:** confirm production has migrations up to **0015** (`supabase/migrations/`).

## Launch day (in this order)

1. [ ] **Vercel → Production env vars** (merchant key and passphrase as *Sensitive*):
   - `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` — the **live** account
   - `PAYFAST_SANDBOX` — **unset** (or anything but `true`)
   - `PAYFAST_SKIP_REMOTE_CHECKS` — **never** set (ignored in production anyway)
   - check `CRON_SECRET` and `ADMIN_PASSWORD` are set
2. [ ] **Remove the sandbox vars from Preview** (or keep them for previews only — never on Production).
3. [ ] **Run `supabase/launch/pricing-launch.sql`** in the Supabase SQL editor. It gives albums from before plans 90 days, and gives Free albums made while we were still building a fresh 30 days (so switching deletion on doesn't remove them straight away).
4. [ ] **Redeploy** (env var changes need a new deployment): Vercel → Deployments → Redeploy.
5. [ ] **Real payment test:** on the live site, create an album, buy the cheapest item (+50 guests, R79) with your own card, check the album updates by itself, the payment shows in `/admin` (album → Payments) and in PayFast. Refund it in PayFast.
6. [ ] **Switch on the rules** (Production env vars), then redeploy:
   - `PLAN_LIMITS_ENFORCED=true` — new guests beyond a plan's limit are turned away
   - `EXPIRY_DELETE_ENABLED=true` — the daily job really deletes expired albums
7. [ ] **Watch the first day:** `/admin` overview (uploads refused, expiring soon), Vercel logs for `/api/payfast/notify` and `/api/cron/expire`.

## After launch

- Expiry reminder emails live (see Email above).
- Monetisation Stage C (host accounts, packs, coupons, Pro) — [PRICING.md](PRICING.md).
- Update the "Early album" wording in `components/PlanSheet.tsx` (it says "kept at least 90 days after plans launch"; after launch these albums show a real date anyway).
