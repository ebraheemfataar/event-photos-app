-- Admin albums table: status tabs, plan filter and sortable columns (docs/ROADMAP.md →
-- Admin portal). Run once against your Supabase project, AFTER 0012_admin.sql.
-- Safe before the app release that uses it: the old 3-argument version is
-- replaced by one whose extra arguments all have defaults, so callers that
-- pass only search/limit/offset (the live app) keep working.

-- Status (same rules as the admin UI):
--   expired = expires_at has passed
--   live    = uploads open and not expired
--   closed  = uploads closed and not expired

drop function if exists public.admin_event_list(text, integer, integer);
drop function if exists public.admin_event_list(text, integer, integer, text, text, boolean);

create or replace function public.admin_event_list(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default 'all',      -- all | live | closed | expired
  p_sort text default 'created',    -- created | name | photos | guests | storage | last_upload
  p_desc boolean default true,
  p_plan text default null          -- null = any | free | small | medium | unlimited | early (from before plans)
)
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
    where (p_search is null or p_search = '' or e.name ilike '%' || p_search || '%' or e.id::text = p_search)
      and (p_plan is null or p_plan = ''
           or (p_plan = 'early' and e.legacy_uncapped)
           or (p_plan <> 'early' and not e.legacy_uncapped and e.plan = p_plan))
      and case coalesce(p_status, 'all')
            when 'expired' then e.expires_at is not null and e.expires_at <= now()
            when 'live'    then e.is_active and (e.expires_at is null or e.expires_at > now())
            when 'closed'  then not e.is_active and (e.expires_at is null or e.expires_at > now())
            else true
          end
  ),
  stats as (
    select
      m.id, m.name, m.created_at, m.is_active, m.plan, m.expires_at, m.legacy_uncapped,
      (select count(*)::integer from public.photos p where p.event_id = m.id) as photos,
      (select count(distinct p.guest_hash)::integer from public.photos p where p.event_id = m.id and not p.by_host) as contributors,
      (select max(p.created_at) from public.photos p where p.event_id = m.id) as last_upload,
      (select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
         from storage.objects o
         where o.bucket_id = 'event-photos' and o.name like m.id::text || '/%') as storage_bytes
    from matched m
  )
  select s.*, count(*) over () as total_count
  from stats s
  order by
    case when p_desc then
      case p_sort
        when 'photos' then s.photos::numeric
        when 'guests' then s.contributors::numeric
        when 'storage' then s.storage_bytes::numeric
        when 'last_upload' then extract(epoch from s.last_upload)::numeric
        when 'created' then extract(epoch from s.created_at)::numeric
      end
    end desc nulls last,
    case when not p_desc then
      case p_sort
        when 'photos' then s.photos::numeric
        when 'guests' then s.contributors::numeric
        when 'storage' then s.storage_bytes::numeric
        when 'last_upload' then extract(epoch from s.last_upload)::numeric
        when 'created' then extract(epoch from s.created_at)::numeric
      end
    end asc nulls last,
    case when p_sort = 'name' and p_desc then lower(s.name) end desc,
    case when p_sort = 'name' and not p_desc then lower(s.name) end asc,
    s.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.admin_event_list(text, integer, integer, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_event_list(text, integer, integer, text, text, boolean, text) to service_role;

-- Counts for the status tabs (respecting the search box and plan filter).
drop function if exists public.admin_event_counts(text);
create or replace function public.admin_event_counts(p_search text default null, p_plan text default null)
returns table (all_count bigint, live bigint, closed bigint, expired bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*),
    count(*) filter (where e.is_active and (e.expires_at is null or e.expires_at > now())),
    count(*) filter (where not e.is_active and (e.expires_at is null or e.expires_at > now())),
    count(*) filter (where e.expires_at is not null and e.expires_at <= now())
  from public.events e
  where (p_search is null or p_search = '' or e.name ilike '%' || p_search || '%' or e.id::text = p_search)
      and (p_plan is null or p_plan = ''
           or (p_plan = 'early' and e.legacy_uncapped)
           or (p_plan <> 'early' and not e.legacy_uncapped and e.plan = p_plan));
$$;

revoke all on function public.admin_event_counts(text, text) from public, anon, authenticated;
grant execute on function public.admin_event_counts(text, text) to service_role;

-- Headline numbers for the top of the admin page.
create or replace function public.admin_stats()
returns table (
  albums bigint,
  albums_7d bigint,
  live bigint,
  active_24h bigint,
  expiring_7d bigint,
  photos bigint,
  photos_24h bigint,
  contributors bigint,
  storage_bytes bigint,
  uploads_refused_24h bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.events),
    (select count(*) from public.events where created_at > now() - interval '7 days'),
    (select count(*) from public.events where is_active and (expires_at is null or expires_at > now())),
    (select count(distinct event_id) from public.photos where created_at > now() - interval '24 hours'),
    (select count(*) from public.events where expires_at > now() and expires_at <= now() + interval '7 days'),
    (select count(*) from public.photos),
    (select count(*) from public.photos where created_at > now() - interval '24 hours'),
    (select count(distinct guest_hash) from public.photos where guest_hash is not null and not by_host),
    (select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects where bucket_id = 'event-photos'),
    -- Tickets from the last day that never became a photo (refused content,
    -- abandoned or failed uploads). Tickets under 10 minutes old may still finish.
    (select count(*) from public.upload_tickets t
       where t.created_at > now() - interval '24 hours'
         and t.created_at < now() - interval '10 minutes'
         and not exists (select 1 from public.photos p where p.id = t.photo_id));
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
