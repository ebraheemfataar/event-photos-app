-- Event photo-sharing app: initial schema, RLS policies, storage bucket, realtime.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  host_token  uuid not null default gen_random_uuid(),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  storage_path  text not null,
  guest_name    text check (char_length(guest_name) <= 60),
  content_type  text,
  created_at    timestamptz not null default now()
);

create index photos_event_id_created_at_idx
  on public.photos (event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.photos enable row level security;

create policy "anon can create events"
  on public.events for insert
  to anon
  with check (true);

create policy "anon can read events"
  on public.events for select
  to anon
  using (true);

create policy "anon can insert photos for existing active events"
  on public.photos for insert
  to anon
  with check (
    exists (
      select 1 from public.events e
      where e.id = photos.event_id and e.is_active
    )
  );

create policy "anon can read photos"
  on public.photos for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- Storage: public bucket for event photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

create policy "anon can upload into an existing event's folder"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.photos;
