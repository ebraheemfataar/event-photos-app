-- Allow animated GIFs.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`),
-- AFTER 0005_storage_limits_active_uploads.sql.
--
-- The app uploads GIFs without compressing them (lib/compressOptions.ts,
-- PASSTHROUGH_TYPES): compressing redraws the image on a canvas, which keeps
-- only the first frame. GIFs carry no EXIF block, so this doesn't leak
-- location data. They share the bucket's 10 MB file_size_limit from 0005;
-- the upload form skips larger GIFs with a message before they're sent.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
]
where id = 'event-photos';
