-- Monetisation Stage A: plans, expiry, usage (docs/PRICING.md → Stage A).
-- Run once against your Supabase project, AFTER 0010_server_uploads_only.sql.
--
-- Safe to apply before the app release that uses it: new tables, and new
-- event columns with defaults. Nothing is charged or enforced yet:
--   * the contributor cap is shown but enforced only in Stage B;
--   * the expiry job (app/api/cron/expire) runs in report-only mode until
--     EXPIRY_DELETE_ENABLED=true is set on the server.
--
-- Limits live ONLY in `plans` / `add_ons` (PRICING.md: "nothing hardcoded").
-- Prices are integer cents (ZAR). Not VAT-registered, so prices are final.

create table public.plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  max_contributors integer check (max_contributors is null or max_contributors > 0), -- null = no limit
  retention_days integer check (retention_days is null or retention_days > 0),        -- null = forever
  shows_badge boolean not null,
  sort_order integer not null
);

insert into public.plans (id, name, price_cents, max_contributors, retention_days, shows_badge, sort_order) values
  ('free',      'Free',      0,     20,   30,   true,  1),
  ('small',     'Small',     14900, 100,  90,   true,  2),
  ('medium',    'Medium',    39900, 300,  365,  false, 3),
  ('unlimited', 'Unlimited', 79900, null, null, false, 4);

create table public.add_ons (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  extra_contributors integer not null default 0 check (extra_contributors >= 0),
  extra_retention_days integer not null default 0 check (extra_retention_days >= 0),
  stackable boolean not null default false,
  sort_order integer not null
);

insert into public.add_ons (id, name, price_cents, extra_contributors, extra_retention_days, stackable, sort_order) values
  ('keep_1yr',  'Keep for 1 more year', 4900, 0,  365, false, 1),
  ('guests_50', '+50 guests',           7900, 50, 0,   true,  2);

-- Read only through the server (service role), like everything else.
alter table public.plans enable row level security;
alter table public.add_ons enable row level security;
revoke all on public.plans, public.add_ons from anon, authenticated;

-- Event columns.
--   expires_at: null = never deleted. New events get now() + their plan's
--     retention (trigger below). Events that existed before this migration
--     stay null ("legacy") until pricing launches; Stage B's launch migration
--     sets them to launch + 90 days.
--   legacy_uncapped: events created before pricing never get a contributor cap.
alter table public.events
  add column plan text not null default 'free' references public.plans (id),
  add column expires_at timestamptz,
  add column extra_contributors integer not null default 0 check (extra_contributors >= 0),
  add column host_email text check (host_email is null or (char_length(host_email) <= 254 and host_email like '%_@_%.__%')),
  add column legacy_uncapped boolean not null default false;

update public.events set legacy_uncapped = true;

create or replace function public.set_event_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expires_at is null and not new.legacy_uncapped then
    select case when p.retention_days is null then null
                else coalesce(new.created_at, now()) + make_interval(days => p.retention_days) end
      into new.expires_at
      from public.plans p
      where p.id = new.plan;
  end if;
  return new;
end;
$$;

create trigger events_set_expiry
  before insert on public.events
  for each row execute function public.set_event_expiry();

create index events_expires_at_idx on public.events (expires_at) where expires_at is not null;

-- Usage for the host's plan sheet and (Stage B) the cap check.
-- Contributors = distinct guest ids that added at least one photo; the host
-- never counts (PRICING.md decision 1).
create or replace function public.event_usage(p_event_id uuid)
returns table (photos integer, contributors integer)
language sql
stable
set search_path = ''
as $$
  select count(*)::integer,
         count(distinct p.guest_hash) filter (where not p.by_host)::integer
  from public.photos p
  where p.event_id = p_event_id;
$$;

revoke all on function public.event_usage(uuid) from public, anon, authenticated;
