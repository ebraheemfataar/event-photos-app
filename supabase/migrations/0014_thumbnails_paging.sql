-- Big albums: thumbnails + paged loading (docs/ROADMAP.md → Backlog).
-- Run once against your Supabase project, AFTER 0013_admin_filters.sql.
-- Safe before the app release that uses it: two nullable columns, an index
-- and a read-only function.
--
-- Thumbnails: the uploading phone also makes a small copy (~480 px) and
-- uploads it next to the photo as `<event id>/<photo id>.thumb.jpg`. The grid
-- shows it via /photos/<id>/thumb; photos without one (older uploads, GIFs)
-- fall back to the full photo.

alter table public.photos
  add column thumb_path text
    check (thumb_path is null or (char_length(thumb_path) <= 200 and thumb_path like event_id::text || '/%'));

alter table public.upload_tickets
  add column thumb_path text;

-- Paged loading: newest first, keyset on (created_at, id).
create index if not exists photos_event_created_idx on public.photos (event_id, created_at desc, id desc);

-- Totals for the album header (photos + distinct guest names), so the
-- numbers are right even before every page of photos has loaded.
create or replace function public.event_album_stats(p_event_id uuid)
returns table (photos integer, guests integer)
language sql
stable
set search_path = ''
as $$
  select count(*)::integer,
         count(distinct lower(btrim(p.guest_name))) filter (where p.guest_name is not null and btrim(p.guest_name) <> '')::integer
  from public.photos p
  where p.event_id = p_event_id;
$$;

revoke all on function public.event_album_stats(uuid) from public, anon, authenticated;
grant execute on function public.event_album_stats(uuid) to service_role;
