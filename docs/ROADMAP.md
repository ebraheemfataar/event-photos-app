# Snap & Share — Roadmap

What's shipped, what's next, and the order to build it in. Screen designs for
every phase are in [`docs/design/snap-share-v4-spec.html`](design/snap-share-v4-spec.html)
(board names are referenced below in *italics*).

**Live:** https://event-photos-app-six.vercel.app · **Hosted DB migrations applied:** 0001–0004

| Phase | Theme | Status | Size |
|---|---|---|---|
| 0 | MVP: create event, QR, upload, live gallery | ✅ Shipped | — |
| 1 | V3 visual redesign + demo + local DB | ✅ Shipped (`d3af8e1`) | — |
| **2a** | **Security quick wins** (bucket limits, uploads only to open events, EXIF check) + GIFs | ✅ Shipped (`05faee2`, migrations 0005–0006) | S |
| **2b** | **Stop data enumeration** (server-side reads, private bucket, scoped realtime) | 🔧 Built on `security-2b` — ship with `0007` | M |
| **2c** | **Upload limits + guests delete their own** | Planned | M |
| 3 | Host photo delete | Planned | S |
| 4 | Privacy extras: consent, storage cleanup, retention | Planned | S–M |
| 5 | Likes & comments | Planned | M |
| 6 | Guest access: codes, approval, pass words | Planned | L |
| 7 | Host accounts, My events, settings, team | Planned | L |
| 8 | Reports & moderation | Planned | M |
| 9 | Event location | Planned | S–M |
| — | Backlog / tech debt | Ongoing | — |

**Why security comes first:** the app is live, and the read policies from
`0001_init.sql` (`using (true)` on `events` and `photos`) plus a public bucket
mean anyone holding the public anon key can list and download every event's
photos and guest names. Phase 2 closes that before any new features.
Phase 3 (host delete) is small and can slot in alongside 2a–2c.

---

## ✅ Phase 0 — MVP

- Create an event from the landing page → private host URL (`/host/[id]?t=<host_token>`).
- Host page shows a QR code for the guest URL (`/e/[id]`).
- Guests upload from their phone (client-side compression), with an optional name and prompt.
- Live gallery via Supabase Realtime (INSERT on `photos`).
- Migrations: `0001_init`, `0002_add_photo_prompts`.

## ✅ Phase 1 — V3 redesign

- New theme tokens (light/dark), Geist + Geist Mono.
- Guest album as a social profile: cover, stats, prompt highlight filters, Grid/Feed tabs, bottom bar (mobile) / sidebar (desktop).
- Host page: private-link banner, printable QR table card, copy/download/share.
- Story-style photo viewer, upload sheet with progress + retry, empty/skeleton/error states, live arrivals animate in.
- New landing page; `/demo` mock album with real event photos.
- Local Supabase stack (`npm run db:start`, seed event) — see `CLAUDE.md`.
- `0003_lock_down_host_token` (host token no longer readable; `create_event` / `is_event_host` RPCs) and `0004_add_photo_delete` (`delete_event_photo` RPC) applied to production.

---

## Phase 2 — Security hardening

### Current gaps (live today), most severe first

1. **Anyone can list every photo of every event.** `events` and `photos` have anon `select … using (true)`. The anon key ships in the browser bundle, so `GET /rest/v1/photos?select=*` with no filter returns all photos, guest names and storage paths across all events. The UI only shows one event, but the database doesn't enforce it.
2. **The bucket accepts any file of any size.** `event-photos` has no `allowed_mime_types` or `file_size_limit`, and the storage insert policy only checks the event *exists*, not that it's *active*.
3. **Photos are public forever.** The bucket is public; any photo URL works for anyone, indefinitely, even after the event closes.
4. **No upload rate limits.** A script can flood an album or fill storage.
5. **Guests can't delete their own photos** (a privacy-law expectation, e.g. POPIA — referenced in the design boards).
6. **Smaller:** EXIF/GPS stripping is assumed but untested; deleted photos leave their file bytes in storage; nothing deletes old albums.

### Phase 2a — Quick wins · Size S · 🔧 built, verified locally

- ✅ `0005_storage_limits_active_uploads.sql`: bucket allows only JPEG/PNG/WebP/HEIC/HEIF up to 10 MB; storage uploads require an **active** event (matching the `photos` insert policy).
- ✅ GPS/EXIF stripping verified: the library always re-encodes on a canvas and only copies EXIF back with `preserveExif` (now explicit `false` in `lib/compressOptions.ts`). `tests/exif.spec.ts` builds a GPS-tagged JPEG, compresses it with the app's options in Chrome and checks no EXIF survives (and fails if `preserveExif` is turned on).
- ✅ Found and fixed: the compression web worker downloaded the library from `cdn.jsdelivr.net` at upload time. It now loads a self-hosted copy (`public/vendor/`), with the package pinned to that exact version.
- ✅ First tests: `npm test` (Playwright). `tests/upload.spec.ts` is an opt-in end-to-end guest upload against the local stack, which also asserts no CDN requests.

Verified against the local stack: real JPEG to an open event → 200; HTML file, 11 MB file, closed event, made-up event id → rejected.
Not covered (by design, see 2c): Storage trusts the declared content type, so a non-image labelled `image/jpeg` is still accepted. It's served back as an image, so browsers won't run it. 2c's server-issued uploads can check the actual bytes.

- ✅ **Animated GIFs** (`0006_allow_gif_uploads.sql`): GIFs skip compression, since redrawing keeps only the first frame, and GIFs carry no EXIF. They're capped at 10 MB; larger ones are skipped with a message while the rest of the batch uploads. Uploaded files are now named by their real type (e.g. HEIC that became PNG gets `.png`). Covered by two E2E tests: a two-frame GIF round-trips byte-for-byte, and an 11 MB GIF is skipped.

**To ship:** run `0005`, then `0006`, in the Supabase SQL editor (safe any time; neither breaks the live app), then deploy.

### Phase 2b — Stop enumeration · Size M · 🔧 built on `security-2b`, verified locally

Goal: you can only see an event's photos if you know that event's id (i.e. you have the link), enforced by the server, not the UI.

- ✅ `0007_lock_down_reads.sql`: anon has no SELECT on `events` / `photos`; insert policies use a SECURITY DEFINER `event_is_active()` helper; bucket is private; photos removed from `postgres_changes`; `broadcast_photo_change` trigger added.
- ✅ **Reads on the server** with a server-only service-role key (`lib/supabase/server.ts`, `lib/data.ts`), always scoped to the id in the URL. This ends the strict "no backend" setup for reads; writes still go through RLS / RPCs.
- ✅ **Photos served by `/photos/<photo id>`** (`app/photos/[photoId]/route.ts`) instead of the signed URLs planned here. Signed URLs change on every page load, which defeats the image cache and would burn Vercel's 5K/month optimisation allowance; a stable URL caches for an hour, still needs the unguessable photo id, and stops working when the photo is deleted. Responses send `nosniff` and only image content types.
- ✅ **Live updates via Broadcast**: the trigger sends only `{id}` on `event:<event id>`; the album verifies each message with a Server Function before changing anything, so forged broadcasts (anyone can send on a public channel) do nothing. Deletes now arrive live too (ready for Phase 3).
- ✅ `tests/security.spec.ts`: unfiltered anon reads return nothing; the public storage URL fails and anon can't sign links; `/photos/<id>` serves until the host deletes it, then 404; forged insert/delete broadcasts are ignored while real ones arrive; host/guest pages still work. All E2E tests pass 3× in a row.

**To ship** (breaks the old code, so do it in one short window like 0003):
1. Vercel → Settings → Environment Variables: add `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API keys → `service_role` / secret key), **Sensitive**, Production + Preview.
2. Push `security-2b`, wait for its preview deployment to be Ready.
3. Run `0007_lock_down_reads.sql` in the Supabase SQL editor (the live site's albums break until step 5).
4. Test the preview: create an event, upload from a second window (appears live), view-only link, `/demo`.
5. Merge to `main`.

### Phase 2c — Upload limits + delete own · Size M

- **Server-issued upload URLs.** A server action checks limits, then returns a one-time signed upload URL (`createSignedUploadUrl`) and inserts the `photos` row; the browser uploads straight to Storage. Direct anon storage inserts are then removed.
- **Rate limits** in that server step: e.g. 50 uploads/hour per device and per IP, plus a whole-album cap (needs a small store — a Postgres table or Upstash/Vercel KV).
- **Device id:** a random id in `localStorage`, stored on `photos.device_id`. Becomes `pass_id` in Phase 6.
- **Guests delete their own photos:** "⋯ → Delete my photo" in the viewer for photos with your device id (*Guest — consent, delete own, report, limits* ②), via an RPC or server action that checks the device id.

**Done when:** a script that tries 100 uploads gets cut off; a guest can delete their own photo but not anyone else's.

---

## Phase 3 — Host photo delete · Size S

**Goal:** the host can remove any photo, and it disappears for everyone.

- "Remove photo" button (host only) in the story viewer and on feed posts — *Host tab bar + settings ②*, *Web — photo + comments* (dark/host).
- Confirm step ("Remove for everyone?").
- Call `delete_event_photo(photo_id, host_token)` (live since 0004); the token is the `?t=` param already on the page.
- Every open album drops the photo live (DELETE event — `postgres_changes` today, Broadcast after Phase 2b).

**DB:** none.
**Done when:** the host removes a photo on one device and it vanishes from a guest's open album without a refresh.

## Phase 4 — Privacy extras · Size S–M

Boards: *Guest — consent, delete own, report, limits*, *Handoff — safety, privacy & location* (column 01).

- **Consent card** on first upload: "Guests of this event see what you post" · "We remove location from your photos" · "You can delete anything you post". Shown once per device.
- **Storage cleanup:** an Edge Function / scheduled job (service role) purges files whose `photos` row was deleted (closes the gap noted in `0004`).
- **Retention:** `events.delete_after` (default `created_at + 90 days`); a daily job deletes expired events and their files; a "This album closes on …" banner. (Host reminder emails come with accounts in Phase 7.)

## Phase 5 — Likes & comments · Size M

Boards: *Live feed*, *Story viewer*, *Comments sheet*, *States — empty, posting, like, comments*, *Handoff — likes & comments*.

- Heart button + **double-tap to like** (never unlikes; white heart burst, off for reduced motion).
- **Optimistic likes:** fill + count at once; roll back with a quiet toast if the save fails.
- **Comments sheet:** bottom sheet, 6 quick emoji, name remembered from upload, max 300 chars, plain text.
- Counts on grid tiles and feed posts; "Liked by X and N others"; "Most loved" tab on desktop.
- Host can remove any comment.
- Realtime for likes and comments (same Broadcast topic as photos).

**DB (`likes_comments` migration, sketch in the handoff board):** `photo_likes (photo_id, device_id)`, `photo_comments (id, photo_id, guest_name, body)`, a `photo_stats` view, `unlike_photo` and `host_delete_comment(comment_id, host_token)` RPCs. Reads go through the server like photos (Phase 2b); comments get the same rate limits as uploads (1 per 5 s).

**Depends on:** 2b (reads), 2c (device id, rate limits).

## Phase 6 — Guest access · Size L

Boards: *Flow · Login & access*, *Guest joins*, *How pass words work*, *Errors — wrong code, not let in…*, *Access, waiting room, team, review*, *Roles & permissions*.

- `events.access_mode`: `open` | `code` (default) | `approval`.
- **Event code:** 6 chars, no 0/O/1/I; printed on the table card; QR pre-fills it; "New code" for the host.
- **Guest pass:** name + 2 generated pass words to rejoin on another device; lasts 24 h / 48 h / until closed; save via WhatsApp / Notes / Copy.
- **Waiting room** (approval mode): host lets in / denies; the guest page unlocks live.
- **Pass expiry → view-only**; guests can still download their own photos.
- **View-only links** for people who couldn't come (`view_links`: show names, show comments, allow downloads, revoke).
- Error screens: wrong code (shake), not let in, link turned off, not found.
- Lockout: 5 wrong pass-word tries → 60 s cooldown; pass words hashed.

**DB:** `guest_passes`, `view_links`, `events.access_mode/code/pass_length`; `device_id` → `pass_id`.

## Phase 7 — Host accounts & settings · Size L

Boards: *Host sign-in & events — mobile/web*, *Host tab bar + settings*, *Web — host dashboard & settings*, *Safety — host* (keep album).

- **Supabase Auth:** email magic link (+ pass words as password). Old `?t=` links still work and offer to "claim" the event into the account.
- **My events** (`/events`): cards with status (Live / Upcoming / Closed), filter chips, event switcher in the host header.
- **Settings:** event details (name, date, cover, note, handle), guest permissions (upload / like / comment / download / anonymous), prompts on/off + custom prompts, close album, delete event.
- **Team:** co-host (account) and helpers (link + pass words, 30 days).
- **Keep album:** 30 / 90 days / 1 year / forever; reminder emails at −14 / −3 days; "Download all (.zip)".

**DB:** `events.owner_id`, `event_members (role)`, settings columns, custom prompts table; host checks move to `auth.uid()`.

## Phase 8 — Reports & moderation · Size M

Boards: *Photo limit per guest*, *Guest — consent, delete own, report, limits*, *Host — keep album, view-only link, reports*, *Access … review*.

- **Photos per guest** (10 / 25 / 50 / none), "N left" counter in the upload screen, "Ask for 10 more" → host/helper approves. (Builds on 2c's limits.)
- **Report** a photo/comment (reason + note) → hidden for the reporter at once; 3 reports → hidden for everyone until reviewed.
- **Review queue:** Keep / Remove / Block guest (block revokes the pass).
- *Next MVP:* automatic text filter (mask words) and image moderation (e.g. AWS Rekognition) → hidden until reviewed.

## Phase 9 — Event location · Size S–M

Board: *Event location*, handoff column 03.

- Host picks the venue with Google Places Autocomplete → store `place_id`, name, address, lat/lng on `events`.
- Pin line under the event name + small map card (Maps Static API); event info sheet with "Open in Google Maps" / Directions.
- `events.show_location` switch (off = host and team only). Never store guests' GPS.

---

## Backlog / tech debt

- **Tests:** EXIF (always), plus opt-in E2E uploads and security checks against the local stack. Missing: an E2E test of creating an event through the landing page; running the E2E suite in CI.
- **Not-found pages return HTTP 200**, not 404, for unknown album ids: `loading.tsx` streams the page before the lookup finishes. Visitors see the right page; crawlers and monitoring see the wrong status. Fix by looking up the event before streaming (or dropping `loading.tsx` for those routes).
- **Hosted migrations are applied by hand.** Consider `npx supabase link` + `db push` so the dashboard tracks them.
- **Event fields** the design assumes but the DB lacks: date, note for guests, cover photo, custom handle (today the handle comes from the name and the cover is the first photo).
- **Upload composer polish:** preview of picked photos, one prompt for the batch, posting progress in the feed (*Upload composer*).
- **Selfie prompt** has no demo photo yet (`lib/demoPhotos.ts`).
- **Vercel Hobby limits:** 5K image optimisations / month; watch usage once real events run.
- **Custom domain** (Vercel production checklist).
- **Videos:** the photo-limit board mentions "videos count as 3 photos"; not designed further.
