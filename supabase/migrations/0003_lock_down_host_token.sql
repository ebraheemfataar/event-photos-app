-- Closes a pre-existing authorization gap: events.host_token is the only
-- thing that makes "host" mean anything in this app, but it is currently
-- readable by ANY anon caller.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).
--
-- Why this is needed (read before applying):
--   `0001_init.sql` created a single, unrestricted select policy on
--   `events`:
--     create policy "anon can read events" on public.events for select
--       to anon using (true);
--   Row Level Security is *row*-level, not column-level. `using (true)`
--   means every row is visible, with every column, to every anon caller.
--   Concretely, anyone holding the public anon key (which is public by
--   design — see CLAUDE.md) can already run, for any event id they know or
--   guess:
--     select host_token from events where id = '<event id>';
--   directly against PostgREST, with no need for the app UI at all. In
--   fact `app/e/[id]/page.tsx` — the *guest*-facing page — already selects
--   `host_token` today (`.select("id, name, host_token, is_active, ...")`),
--   even though guests have no legitimate use for it.
--
--   This means host_token is not currently a secret. Any future RLS policy
--   that tries to gate a host-only action (e.g. deleting a photo) by
--   comparing a caller-supplied value against `events.host_token` would be
--   security theatre: an attacker just reads the real token from the open
--   `events` select first, then replays it. That is exactly the kind of
--   "looks safe but isn't" policy to avoid — so it's fixed here, as a
--   prerequisite for 0004_add_photo_delete.sql.
--
-- Fix: revoke table-level SELECT on `events` from anon, replace it with a
-- column-level grant that excludes host_token, and move the two
-- legitimate uses of host_token (learning your own token once at creation
-- time, and checking whether a presented token is correct) into
-- SECURITY DEFINER functions that never return the token itself except at
-- creation.
--
-- REQUIRED APP-CODE FOLLOW-UP (not made here — DB/migration only):
--   * components/CreateEventForm.tsx currently does
--       supabase.from("events").insert({ name }).select("id, host_token")
--     This will start failing (permission denied for column host_token)
--     once this migration is applied, because anon can no longer insert
--     directly (see policy drop below) or select host_token as a column.
--     It must instead call:
--       supabase.rpc("create_event", { p_name: name })
--     which returns the same shape (id, name, host_token, is_active,
--     created_at) as a one-row result.
--   * app/host/[id]/page.tsx and app/e/[id]/page.tsx currently select
--     `host_token` from `events` to build `isHost` client/render-side.
--     They must stop selecting that column (drop it from the `.select()`
--     list — it will error otherwise) and instead compute `isHost` via:
--       supabase.rpc("is_event_host", { p_event_id: id, p_host_token: t })
--     which returns a boolean.

-- ---------------------------------------------------------------------------
-- 1. Column-level lockdown of events.host_token for anon.
-- ---------------------------------------------------------------------------

revoke select on public.events from anon;

grant select (id, name, is_active, created_at) on public.events to anon;

-- The existing "anon can read events" policy (using (true)) is left as-is:
-- row visibility is unchanged, only the host_token column is no longer
-- selectable by anon. Any query that tries to select host_token directly
-- (`select *`, or explicitly listing it) will now fail with a Postgres
-- "permission denied for column host_token" error.

-- ---------------------------------------------------------------------------
-- 2. Direct anon inserts into events are replaced by a single audited path.
-- ---------------------------------------------------------------------------
-- Event creation is the one moment a host is legitimately allowed to learn
-- their own host_token in plaintext. Rather than relying on
-- insert(...).select(...) (which needs SELECT on host_token — exactly what
-- we just revoked), creation is moved into a SECURITY DEFINER function
-- that reads the freshly-inserted row with its own (elevated) privileges,
-- not the caller's.

drop policy if exists "anon can create events" on public.events;

create or replace function public.create_event(p_name text)
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
    insert into public.events as e (name)
    values (p_name)
    returning e.id, e.name, e.host_token, e.is_active, e.created_at;
end;
$$;

revoke all on function public.create_event(text) from public;
grant execute on function public.create_event(text) to anon;

-- ---------------------------------------------------------------------------
-- 3. Verifying a presented token without ever returning the real one.
-- ---------------------------------------------------------------------------
-- Returns a bare boolean, so it can't be used to recover the token any
-- faster than brute force (each call reveals only "matched" / "did not
-- match" for the caller's own guess).

create or replace function public.is_event_host(p_event_id uuid, p_host_token uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.host_token = p_host_token
  );
$$;

revoke all on function public.is_event_host(uuid, uuid) from public;
grant execute on function public.is_event_host(uuid, uuid) to anon;

-- ---------------------------------------------------------------------------
-- Note on function ownership / SECURITY DEFINER privilege
-- ---------------------------------------------------------------------------
-- These functions run with the privileges of whichever role applies this
-- migration (typically `postgres`, same as every other statement in
-- 0001_init.sql / 0002_add_photo_prompts.sql — e.g. the CREATE POLICY and
-- storage bucket statements already assume that role). That role owns
-- `public.events`, so it is exempt from that table's RLS policies by
-- default (table owners bypass their own table's RLS unless
-- FORCE ROW LEVEL SECURITY is set, which it is not here). If you apply
-- this migration with a different, lower-privileged role, verify these
-- functions can still read host_token — otherwise re-run
-- `alter function ... owner to postgres;` after applying.
