-- Plans count PHOTOS instead of guests; event type; custom table card text.
-- Run once against your Supabase project, AFTER 0015_purchases.sql, and
-- BEFORE deploying the app release that uses it. Additive: the old
-- contributor columns stay (unused by the new code) so the live app keeps
-- working in between; a later migration can drop them.
--
-- Plans (docs/PRICING.md):
--   Free 50 photos / 30 days, Small 100 / 90 days, Medium 500 / 1 year,
--   Large 2,000 / 2 years (replaces Unlimited: no unlimited plan, to keep
--   storage bounded). Every photo counts, the host's too; when an album is
--   full nobody can add more until it's upgraded.
--   Add-on "+100 photos" (R79, stackable) replaces "+50 guests".

-- 1. Photo limits.
alter table public.plans
  add column max_photos integer check (max_photos is null or max_photos > 0); -- null = no limit
alter table public.add_ons
  add column extra_photos integer not null default 0 check (extra_photos >= 0);
alter table public.events
  add column extra_photos integer not null default 0 check (extra_photos >= 0);

insert into public.plans (id, name, price_cents, max_contributors, max_photos, retention_days, shows_badge, sort_order)
values ('large', 'Large', 79900, null, 2000, 730, false, 4)
on conflict (id) do nothing;

update public.plans set max_photos = 50   where id = 'free';
update public.plans set max_photos = 100  where id = 'small';
update public.plans set max_photos = 500  where id = 'medium';

-- Albums on Unlimited move to Large (kept 2 years from when they started).
update public.events
set plan = 'large',
    expires_at = case when legacy_uncapped then expires_at
                      else coalesce(expires_at, created_at + interval '730 days') end
where plan = 'unlimited';
update public.event_purchases set item = 'large' where kind = 'plan' and item = 'unlimited';
delete from public.plans where id = 'unlimited';

insert into public.add_ons (id, name, price_cents, extra_contributors, extra_photos, extra_retention_days, stackable, sort_order)
values ('photos_100', '+100 photos', 7900, 0, 100, 0, true, 2)
on conflict (id) do nothing;
-- Each "+50 guests" bought becomes "+100 photos".
update public.events set extra_photos = (extra_contributors / 50) * 100 where extra_contributors > 0;
update public.event_purchases set item = 'photos_100' where kind = 'add_on' and item = 'guests_50';
delete from public.add_ons where id = 'guests_50';

-- 2. Event type (wedding, birthday, ...). Optional for albums made before.
alter table public.events
  add column event_type text
    check (event_type is null or event_type in
      ('wedding', 'engagement', 'birthday', 'baby_shower', 'graduation', 'corporate', 'party', 'other'));

-- create_event gains p_event_type. Dropped and re-made (not overloaded) so
-- calls stay unambiguous; the old app's 4 named arguments still match.
drop function if exists public.create_event(text, text, date, text);

create function public.create_event(
  p_name text,
  p_theme text default 'classic',
  p_event_date date default null,
  p_note text default null,
  p_event_type text default null
)
returns table (
  id uuid,
  name text,
  host_token uuid,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    insert into public.events as e (name, theme, event_date, note, event_type)
    values (
      p_name,
      coalesce(p_theme, 'classic'),
      p_event_date,
      nullif(btrim(coalesce(p_note, '')), ''),
      nullif(btrim(coalesce(p_event_type, '')), '')
    )
    returning e.id, e.name, e.host_token, e.is_active, e.created_at;
end;
$$;

revoke all on function public.create_event(text, text, date, text, text) from public;
grant execute on function public.create_event(text, text, date, text, text) to anon;

-- 3. Custom table card text: null = the default wording. Shape
--    {"eyebrow": "...", "message": "...", "pill": "..."}, validated by the
--    server (lib/cardText.ts) before it's saved; the check is a backstop.
alter table public.events
  add column card_text jsonb
    check (card_text is null or (jsonb_typeof(card_text) = 'object' and pg_column_size(card_text) <= 2000));
