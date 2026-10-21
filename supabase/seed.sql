-- Local development seed. Runs automatically on `npm run db:start` (first time)
-- and `npm run db:reset`. Never applied to the hosted project.
--
-- Gives you one ready-made event with fixed ids, so the URLs are stable:
--   Guest: http://localhost:3000/e/00000000-0000-4000-8000-000000000001
--   Host:  http://localhost:3000/host/00000000-0000-4000-8000-000000000001?t=00000000-0000-4000-8000-0000000000aa
--
-- Photos point at Unsplash URLs (same set as lib/demoPhotos.ts) instead of
-- objects in the local storage bucket; the album renders any storage_path that
-- starts with https:// as-is. Uploads you make locally go to the local bucket.

insert into public.events (id, name, host_token, is_active, created_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'Sam & Alex''s Wedding',
  '00000000-0000-4000-8000-0000000000aa',
  true,
  now() - interval '4 hours'
);

insert into public.photos (event_id, storage_path, guest_name, content_type, prompt_id, created_at)
select
  '00000000-0000-4000-8000-000000000001',
  'https://images.unsplash.com/photo-' || s.photo || '?auto=format&fit=crop&w=1600&q=80',
  s.guest,
  'image/jpeg',
  s.prompt,
  now() - make_interval(mins => s.minutes_ago)
from (values
  ('1583939003579-730e3918a45a', 'Thandi', 'with-the-host', 2),
  ('1504609813442-a8924e83f76e', 'Noor', 'dance-floor', 5),
  ('1541532713592-79a0317b6b77', 'Sipho', 'cheers', 9),
  ('1559599101-f09722fb4948', 'Aisha', 'made-you-laugh', 14),
  ('1504196606672-aef5c9cefc92', 'Sipho', 'live-music', 18),
  ('1527529482837-4698179dc6ce', 'Jamie', 'cheers', 23),
  ('1525772764200-be829a350797', 'Ravi', 'decor-detail', 31),
  ('1517457373958-b7bdd4587205', 'Ravi', 'dance-floor', 38),
  ('1606216794074-735e91aa2c92', 'Liam', 'with-the-host', 44),
  ('1528605248644-14dd04022da1', 'Zara', 'candid', 52),
  ('1529156069898-49953e39b3ac', 'Sipho', 'group-photo', 61),
  ('1501281668745-f7f57925c3b4', 'Jamie', 'live-music', 70),
  ('1519671482749-fd09be7ccebf', 'Zara', 'cheers', 78),
  ('1519741497674-611481863552', 'Noor', 'best-dressed', 86),
  ('1543269865-cbf427effbad', 'Liam', 'made-you-laugh', 95),
  ('1533174072545-7a4b6ad7a6c3', 'Mia', 'dance-floor', 104),
  ('1530023367847-a683933f4172', 'Aisha', 'decor-detail', 118),
  ('1511285560929-80b456fea0bc', 'Aisha', 'with-the-host', 131),
  ('1465495976277-4387d4b0b4c6', 'Mia', 'candid', 146),
  ('1516450360452-9312f5e86fc7', 'Thandi', 'live-music', 160),
  ('1522673607200-164d1b6ce486', null, 'decor-detail', 175),
  ('1520854221256-17451cc331bf', 'Thandi', 'see-you-soon', 190),
  ('1511632765486-a01980e01a18', 'Jamie', 'see-you-soon', 205)
) as s(photo, guest, prompt, minutes_ago);
