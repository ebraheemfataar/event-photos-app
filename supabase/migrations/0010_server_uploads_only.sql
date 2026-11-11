-- Phase 2c, part 2 of 2: switch off direct anon uploads.
-- Run AFTER 0009_upload_tickets.sql AND after the app release that uploads
-- through lib/uploadActions.ts is live. Running it earlier breaks uploads
-- from the old app until the new one deploys.
--
-- From here on the only way a photo gets into the album is the server flow
-- (rate-limited, content-checked). Signed upload URLs issued by the server
-- don't need an anon storage insert policy, so dropping it closes the direct
-- path without affecting them (covers/posters use the same mechanism).

drop policy if exists "anon can insert photos for active events" on public.photos;
revoke insert on public.photos from anon;

drop policy if exists "anon can upload into an active event's folder" on storage.objects;
