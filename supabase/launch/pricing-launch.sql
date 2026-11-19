-- RUN ONCE, ON LAUNCH DAY (not a migration: never applied automatically).
-- docs/PRICING.md → "Existing live events … become Free with expires_at =
-- launch + 90 days and no contributor cap."
--
-- Launch checklist (in this order):
--   1. Real PayFast credentials on Vercel (PAYFAST_MERCHANT_ID / _KEY /
--      _PASSPHRASE, Sensitive), PAYFAST_SANDBOX unset.
--   2. Terms & refund policy written (app/terms/page.tsx).
--   3. Run this script.
--   4. Set PLAN_LIMITS_ENFORCED=true and EXPIRY_DELETE_ENABLED=true on Vercel.
--   5. Email: Resend account + verified domain, then RESEND_API_KEY + EMAIL_FROM
--      (templates ready: /admin/emails; see docs/ROADMAP.md → Email).

update public.events
set expires_at = now() + interval '90 days'
where legacy_uncapped
  and expires_at is null;
