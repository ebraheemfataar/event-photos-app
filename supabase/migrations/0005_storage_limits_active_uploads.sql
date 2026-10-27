-- Phase 2a security quick wins (docs/ROADMAP.md).
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).
-- Safe to apply any time: the app already uploads compressed JPEG/PNG/WebP
-- files well under the size cap, and only to active events.
--
-- 1. The event-photos bucket accepted any file type of any size, so anyone
--    holding the public anon key could store arbitrary files (HTML, video,
--    executables, very large files) on this project's storage quota.
--    Restrict it to the image types the upload flow produces, plus HEIC/HEIF
--    in case an iPhone hands one over untouched, and cap the size.
--    lib/compressImage.ts targets ~1.2 MB, so 10 MB leaves plenty of room.
--
-- 2. The storage insert policy only checked that the event folder belonged
--    to an *existing* event, while the photos-table insert policy requires
--    an *active* one. That let files be uploaded into closed events (they'd
--    never get a photos row, so they'd sit in storage unseen). Make the two
--    policies agree.

update storage.buckets
set
  file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'event-photos';

drop policy if exists "anon can upload into an existing event's folder" on storage.objects;

create policy "anon can upload into an active event's folder"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and e.is_active
    )
  );
