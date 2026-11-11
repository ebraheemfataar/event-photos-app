-- Phase 2c, part 1 of 2: server-issued uploads (docs/ROADMAP.md → Phase 2c).
-- Run once against your Supabase project, AFTER 0008_event_details.sql.
--
-- Safe to apply before the app release that uses it: it only ADDS a table and
-- two nullable/defaulted columns. The old direct anon uploads keep working
-- until 0010_server_uploads_only.sql, which you run AFTER the new code is live.
--
-- New upload flow (lib/uploadActions.ts, Server Functions using the
-- service-role key):
--   1. startPhotoUpload: checks the event is open, the type, and the rate
--      limits; writes an upload_tickets row; returns a one-time signed
--      upload URL for `<event id>/<photo id>.<ext>`.
--   2. The browser uploads the file straight to Storage with that URL.
--   3. finishPhotoUpload: checks the ticket, sniffs the file's first bytes
--      (it must really be the image type it claims), then inserts the
--      `photos` row. The 0007 trigger broadcasts it live as before.
--
-- Guest ids: each browser keeps a random id (localStorage). Only its SHA-256
-- is stored (`guest_hash`), and it's never sent to other visitors, so it can
-- prove "this is my photo" (delete own) and count contributors (PRICING.md)
-- without being guessable from anything public.

alter table public.photos
  add column guest_hash text
    check (guest_hash is null or guest_hash ~ '^[0-9a-f]{64}$'),
  add column by_host boolean not null default false;

create index if not exists photos_event_guest_idx on public.photos (event_id, guest_hash);

-- One row per started upload. Used for rate limits (per guest, per network,
-- per album) and to make sure step 3 only accepts uploads step 1 issued.
-- IPs are stored as salted hashes, never raw.
create table public.upload_tickets (
  photo_id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  content_type text not null,
  guest_hash text not null check (guest_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null,
  by_host boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index upload_tickets_guest_idx on public.upload_tickets (guest_hash, created_at);
create index upload_tickets_ip_idx on public.upload_tickets (ip_hash, created_at);
create index upload_tickets_event_idx on public.upload_tickets (event_id, created_at);

-- Server-only: RLS on with no policies, and no grants for the public roles.
alter table public.upload_tickets enable row level security;
revoke all on public.upload_tickets from anon, authenticated;
