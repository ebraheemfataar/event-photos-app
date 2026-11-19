-- Monetisation Stage B: purchases (docs/PRICING.md → Stage B).
-- Run once against your Supabase project, AFTER 0014_thumbnails_paging.sql.
-- Safe before the app release that uses it: one new table, server-only.
--
-- A purchase is created "pending" when the host starts checkout, and is only
-- ever marked "paid" by the PayFast ITN handler (app/api/payfast/notify)
-- after it has verified the signature, confirmed with PayFast, and checked
-- the merchant and the amount. Never from the browser's return redirect.
-- Amounts are integer cents (ZAR). No card details are ever stored.

create table public.event_purchases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('plan', 'add_on')),
  item text not null,                         -- plan id or add-on id
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  provider text not null default 'payfast',
  provider_ref text,                          -- PayFast pf_payment_id
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%.__%')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  notification jsonb                          -- the verified ITN fields, for support
);

create index event_purchases_event_idx on public.event_purchases (event_id, created_at desc);
create unique index event_purchases_provider_ref_idx on public.event_purchases (provider, provider_ref) where provider_ref is not null;

alter table public.event_purchases enable row level security;
revoke all on public.event_purchases from anon, authenticated;
