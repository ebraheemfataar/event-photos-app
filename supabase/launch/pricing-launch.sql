-- RUN ONCE, ON LAUNCH DAY (not a migration: never applied automatically).
-- Full checklist and order: docs/LAUNCH.md (this is step 3).
--
-- 1. Albums made before plans existed (legacy) get launch + 90 days
--    (docs/PRICING.md: "become Free with expires_at = launch + 90 days and no
--    contributor cap").
-- 2. Free albums made while the app was still in development got a 30-day
--    date from when they were created. Give any that would expire in under
--    30 days a fresh 30 days from launch, so switching on deletion
--    (EXPIRY_DELETE_ENABLED) doesn't remove them straight away.

update public.events
set expires_at = now() + interval '90 days'
where legacy_uncapped
  and expires_at is null;

update public.events
set expires_at = now() + interval '30 days'
where not legacy_uncapped
  and plan = 'free'
  and expires_at is not null
  and expires_at < now() + interval '30 days';

-- Check: nothing should be due for deletion straight after launch.
select count(*) as albums_expiring_within_a_day
from public.events
where expires_at is not null and expires_at < now() + interval '1 day';
