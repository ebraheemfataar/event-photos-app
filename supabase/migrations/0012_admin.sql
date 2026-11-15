-- Admin portal (docs/ROADMAP.md → Admin portal). Run once against your
-- Supabase project, AFTER 0011_plans.sql. Safe before the app release that
-- uses it: one new table and one new function, both server-only.
--
-- The portal (/admin) signs in with ADMIN_PASSWORD (server env var) and
-- reads/writes with the service-role key. Nothing here is reachable with
-- the public anon key.

-- Everything done in the portal, plus sign-in attempts (also used to lock
-- out repeated wrong passwords). IPs are salted hashes, never raw.
create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  event_id uuid,
  detail jsonb not null default '{}'::jsonb,
  ip_hash text
);

create index admin_audit_at_idx on public.admin_audit (at desc);
create index admin_audit_login_idx on public.admin_audit (ip_hash, at) where action = 'login_failed';

alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- One row per album for the admin list: photos, contributors, last upload
-- and storage used (sum of the files in the album's folder, covers included).
create or replace function public.admin_event_list(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  is_active boolean,
  plan text,
  expires_at timestamptz,
  legacy_uncapped boolean,
  photos integer,
  contributors integer,
  last_upload timestamptz,
  storage_bytes bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with matched as (
    select e.*
    from public.events e
    where p_search is null
       or p_search = ''
       or e.name ilike '%' || p_search || '%'
       or e.id::text = p_search
  )
  select
    m.id, m.name, m.created_at, m.is_active, m.plan, m.expires_at, m.legacy_uncapped,
    (select count(*)::integer from public.photos p where p.event_id = m.id),
    (select count(distinct p.guest_hash)::integer from public.photos p where p.event_id = m.id and not p.by_host),
    (select max(p.created_at) from public.photos p where p.event_id = m.id),
    (select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
       from storage.objects o
       where o.bucket_id = 'event-photos' and o.name like m.id::text || '/%'),
    count(*) over ()
  from matched m
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_event_list(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_event_list(text, integer, integer) to service_role;
