-- Phase 2b (docs/ROADMAP.md): stop anon callers listing every event's data.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`),
-- AFTER 0006_allow_gif_uploads.sql, and only together with the app release
-- that reads through the server (it breaks the old client-side reads).
--
-- Before this migration:
--   * `events` and `photos` had anon SELECT policies `using (true)`. The anon
--     key ships in the browser bundle, so anyone could run
--       GET /rest/v1/photos?select=*        (no filter)
--     and get every photo, guest name and storage path of every event.
--   * The `event-photos` bucket was public, so any storage path worked as a
--     permanent download link.
--
-- After:
--   * anon has no SELECT on `events` or `photos` at all. The Next.js server
--     reads them with the service-role key (lib/supabase/server.ts), and only
--     for the event / photo id in the request — so knowing the id (having the
--     link) is what grants access, enforced on the server, not in the UI.
--   * The bucket is private. The app serves photos via /photos/<photo id>
--     (app/photos/[photoId]/route.ts), which stops working once the photo row
--     is deleted.
--   * Live updates no longer use postgres_changes (which needs anon SELECT).
--     A trigger broadcasts just {id} on the topic `event:<event id>`; the
--     browser then fetches the photo from the server, so a forged broadcast
--     can't inject anything — the server only returns real rows.
--
-- Writes are unchanged (create_event RPC, anon photo insert, anon storage
-- upload, delete_event_photo RPC). The two insert policies used to check the
-- event with a plain `exists (select ... from events)`, which runs as anon
-- and would now fail; they call a SECURITY DEFINER helper instead.

-- ---------------------------------------------------------------------------
-- 1. Helper: is this an existing, active event?
-- ---------------------------------------------------------------------------
-- Takes text so the storage policy can pass the folder name straight in
-- (a malformed folder simply doesn't match, instead of raising a cast error).
-- Returns only a boolean, and only for an id the caller already has.

create or replace function public.event_is_active(p_event_id text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.events e
    where e.id::text = p_event_id
      and e.is_active
  );
$$;

revoke all on function public.event_is_active(text) from public;
grant execute on function public.event_is_active(text) to anon;

-- ---------------------------------------------------------------------------
-- 2. Remove anon reads.
-- ---------------------------------------------------------------------------

drop policy if exists "anon can read events" on public.events;
revoke select on public.events from anon;

drop policy if exists "anon can read photos" on public.photos;
revoke select on public.photos from anon;

-- ---------------------------------------------------------------------------
-- 3. Re-point the insert policies at the helper.
-- ---------------------------------------------------------------------------

drop policy if exists "anon can insert photos for existing active events" on public.photos;
create policy "anon can insert photos for active events"
  on public.photos for insert
  to anon
  with check (public.event_is_active(event_id::text));

drop policy if exists "anon can upload into an active event's folder" on storage.objects;
create policy "anon can upload into an active event's folder"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'event-photos'
    and public.event_is_active((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 4. Private bucket.
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where id = 'event-photos';

-- ---------------------------------------------------------------------------
-- 5. Live updates via Broadcast instead of postgres_changes.
-- ---------------------------------------------------------------------------
-- Payload is only the photo id: nothing readable leaks through the channel,
-- and clients verify every message with the server. Failures are swallowed
-- so a Realtime hiccup can never block an upload or a delete.

create or replace function public.broadcast_photo_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.photos;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('id', v_row.id),
      case when tg_op = 'DELETE' then 'photo_deleted' else 'photo_inserted' end,
      'event:' || v_row.event_id::text,
      false
    );
  exception when others then
    raise warning 'broadcast_photo_change: %', sqlerrm;
  end;

  return v_row;
end;
$$;

drop trigger if exists photos_broadcast on public.photos;
create trigger photos_broadcast
  after insert or delete on public.photos
  for each row execute function public.broadcast_photo_change();

-- postgres_changes is no longer used for photos.
alter publication supabase_realtime drop table public.photos;
