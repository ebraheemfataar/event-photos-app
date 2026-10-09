-- Adds host-authorized photo deletion.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`),
-- AFTER 0003_lock_down_host_token.sql.
--
-- DEPENDS ON 0003_lock_down_host_token.sql. Do not apply this migration on
-- its own: the authorization check below is only meaningful because
-- 0003 makes `events.host_token` unreadable by plain SELECT. Without 0003,
-- any anon caller could read the real host_token for an event straight out
-- of `events` and pass it right back in here — a "host-only" check that
-- accepts whatever token the caller supplies, when that token is public,
-- authorizes nobody.
--
-- What this migration deliberately does NOT do, and why:
--
--   * It does not add a `delete` RLS policy on `public.photos` for `to
--     anon`. There's no column on `photos` a client could use to prove
--     "I'm the host" that a `using` clause could check — the token lives
--     on `events`, not `photos` — and there's no way for a plain DELETE
--     request (`DELETE /rest/v1/photos?id=eq...`) to carry that proof.
--     `public.photos` already has RLS enabled with no delete policy
--     (see 0001_init.sql), so anon DELETE requests are denied outright by
--     default; this migration keeps that default-deny and adds a single
--     audited, self-authorizing RPC as the only path to deletion instead.
--
--   * It does not add a `delete` policy on `storage.objects` for `to anon`
--     either, for the same structural reason: a client-issued
--     storage.remove() call only carries a bucket + list of paths, nothing
--     that could carry "I am the host" in a way a `using` clause could
--     verify without re-deriving the same host_token-in-a-query-filter
--     problem this migration exists to avoid. A policy of the shape
--       using (exists (select 1 from events e
--                      where e.id::text = (storage.foldername(name))[1]
--                        and e.host_token = <something>))
--     has no safe source for <something> in a storage delete request, and
--     anything a client could supply there is exactly as guessable/replayable
--     as an open host_token would be. Real per-request storage authorization
--     would require actual Supabase Auth (JWTs, auth.uid()), which this app
--     does not use (see AGENTS.md / CLAUDE.md: host_token is a bearer
--     token, not real auth).
--
--   Practical consequence: this migration can guarantee a deleted photo
--   disappears from `public.photos` (so it vanishes from the gallery and
--   from Realtime) and from `storage.objects` (so it can no longer be
--   listed or downloaded via the Storage API — the metadata row backing
--   it is gone), but it CANNOT guarantee the underlying object bytes are
--   purged from the storage backend (S3/GCS). Deleting the storage.objects
--   row via SQL removes the bucket's *record* of the file; the physical
--   delete-from-backend step normally happens inside the Storage API's own
--   DELETE handler, not via a database trigger, so a raw SQL row delete
--   bypasses it and leaves an orphaned blob. Given photo paths are
--   `<event uuid>/<random uuid>.<ext>` (see components/PhotoUploadForm.tsx)
--   an orphan is unlinked and unguessable, but it is not truly gone and
--   is not deducted from any storage size limits. Fully purging bytes
--   requires a privileged (service_role) process — e.g. a scheduled
--   cleanup job or an Edge Function invoked by the host — which is real
--   backend code and out of scope for this DB-only migration. Flagging
--   this explicitly rather than shipping a policy that implies the bytes
--   are gone when they aren't.

create or replace function public.delete_event_photo(p_photo_id uuid, p_host_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_storage_path text;
begin
  select p.event_id, p.storage_path
    into v_event_id, v_storage_path
    from public.photos p
    where p.id = p_photo_id;

  if v_event_id is null then
    raise exception 'photo not found';
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = v_event_id
      and e.host_token = p_host_token
  ) then
    raise exception 'not authorized';
  end if;

  delete from public.photos where id = p_photo_id;

  -- Best-effort cleanup of the storage.objects metadata row (see header
  -- comment for why this doesn't purge the physical bytes). Wrapped so
  -- that if the migration-applying role ever lacks privileges on the
  -- storage schema, the photos-row delete above still commits instead of
  -- the whole function rolling back.
  begin
    delete from storage.objects
      where bucket_id = 'event-photos'
        and name = v_storage_path;
  exception
    when insufficient_privilege then
      raise warning 'delete_event_photo: could not remove storage.objects row for %, insufficient privilege', v_storage_path;
  end;
end;
$$;

revoke all on function public.delete_event_photo(uuid, uuid) from public;
grant execute on function public.delete_event_photo(uuid, uuid) to anon;

-- Realtime note: no change needed. public.photos was already added to the
-- supabase_realtime publication in 0001_init.sql with no column/DML
-- restriction (`alter publication supabase_realtime add table
-- public.photos;` defaults to publishing insert/update/delete/truncate),
-- so DELETEs performed by this function already broadcast to subscribers.
-- The app-side Realtime channel currently only listens for INSERT
-- (per CLAUDE.md) — wiring up a DELETE listener (or removing the photo
-- from local state after a successful delete_event_photo() RPC call) is
-- an application-code change, not a migration change.
