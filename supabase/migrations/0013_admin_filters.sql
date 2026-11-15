-- Admin albums table: status tabs and sortable columns (docs/ROADMAP.md →
-- Admin portal). Run once against your Supabase project, AFTER 0012_admin.sql.
-- Safe before the app release that uses it: the old 3-argument version is
-- replaced by one whose extra arguments all have defaults, so callers that
-- pass only search/limit/offset (the live app) keep working.

-- Status (same rules as the admin UI):
--   expired = expires_at has passed
--   live    = uploads open and not expired
--   closed  = uploads closed and not expired

drop function if exists public.admin_event_list(text, integer, integer);

create or replace function public.admin_event_list(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default 'all',      -- all | live | closed | expired
  p_sort text default 'created',    -- created | name | photos | guests | storage | last_upload
  p_desc boolean default true
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

revoke all on function public.admin_event_list(text, integer, integer, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_event_list(text, integer, integer, text, text, boolean) to service_role;

-- Counts for the status tabs (respecting the search box).
create or replace function public.admin_event_counts(p_search text default null)
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
  where p_search is null or p_search = '' or e.name ilike '%' || p_search || '%' or e.id::text = p_search;
$$;

revoke all on function public.admin_event_counts(text) from public, anon, authenticated;
grant execute on function public.admin_event_counts(text) to service_role;
