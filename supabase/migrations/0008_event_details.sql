-- Event details: theme, date, note, cover, poster and links (docs/ROADMAP.md
-- → Event themes / Event details). Run once against your Supabase project
-- (SQL Editor or `supabase db push`), AFTER 0007_lock_down_reads.sql.
--
-- Safe to apply before the app release that uses it: every new column has a
-- default, and create_event keeps working when called with only p_name.
--
-- Who can change these: only the host. The app's Server Functions
-- (lib/eventActions.ts) check the host token with is_event_host and then
-- write with the service-role key, validating everything first. The CHECK
-- constraints below are the backstop if anything ever slips past that.
--
-- Cover and poster images live in the private event-photos bucket under
-- `<event id>/_event/...`. They are NOT rows in `photos`, so they never show
-- up in the album grid, and they're served by app/media/[eventId]/[kind]/[file]
-- only while the column still points at them.

alter table public.events
  add column theme text not null default 'classic'
    check (theme in ('classic', 'gold', 'blush', 'midnight', 'garden')),
  add column event_date date,
  add column note text
    check (note is null or char_length(note) <= 280),
  add column cover_path text
    check (cover_path is null or (char_length(cover_path) <= 200 and cover_path like id::text || '/\_event/%')),
  add column poster_path text
    check (poster_path is null or (char_length(poster_path) <= 200 and poster_path like id::text || '/\_event/%')),
  add column links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 4);

-- create_event: same behaviour as 0003, plus optional theme / date / note
-- picked on the landing page. Old callers passing only p_name still work.
drop function if exists public.create_event(text);

create or replace function public.create_event(
  p_name text,
  p_theme text default 'classic',
  p_event_date date default null,
  p_note text default null
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
    insert into public.events as e (name, theme, event_date, note)
    values (
      p_name,
      coalesce(p_theme, 'classic'),
      p_event_date,
      nullif(btrim(coalesce(p_note, '')), '')
    )
    returning e.id, e.name, e.host_token, e.is_active, e.created_at;
end;
$$;

revoke all on function public.create_event(text, text, date, text) from public;
grant execute on function public.create_event(text, text, date, text) to anon;
