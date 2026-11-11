# Snap & Share — Roadmap

What's shipped, what's next, and the order to build it in. Screen designs for
every phase are in [`docs/design/snap-share-v4-spec.html`](design/snap-share-v4-spec.html)
(board names are referenced below in *italics*). How the app works end to end:
[FLOWS.md](FLOWS.md) (Mermaid process diagrams).

**Live:** https://event-photos-app-six.vercel.app · **Hosted DB migrations applied:** 0001–0008

| Phase | Theme | Status | Size |
|---|---|---|---|
| 0 | MVP: create event, QR, upload, live gallery | ✅ Shipped | — |
| 1 | V3 visual redesign + demo + local DB | ✅ Shipped (`d3af8e1`) | — |
| **2a** | **Security quick wins** (bucket limits, uploads only to open events, EXIF check) + GIFs | ✅ Shipped (`05faee2`, migrations 0005–0006) | S |
| **2b** | **Stop data enumeration** (server-side reads, private bucket, scoped realtime) | ✅ Shipped (`0ce1760`, migration 0007) | M |
| **2c** | **Upload limits + guests delete their own** | 🔧 Built (migrations 0009–0010) | M |
| 3 | Host photo delete | ✅ Shipped (`306ed11`) | S |
| 4 | Privacy extras: consent, storage cleanup, retention | Planned | S–M |
| 5 | Likes & comments | Planned | M |
| 6 | Guest access: codes, approval, pass words | Planned | L |
| **7a** | **"Your albums on this device"** (no login stopgap for My events) | Planned | S |
| 7 | Host accounts, My events, settings, team | Planned | L |
| **A** | **Admin portal** (developer: all albums, close, delete, stats) | Planned, before Monetisation B | M |
| 8 | Reports & moderation | Planned | M |
| 9 | Event location | Planned | S–M |
| **T** | **Event themes + event details** (cover, poster, date, note, links, link previews, table tent) | ✅ Shipped (`d8ca440`, migration 0008) | M |
| **$A–D** | **Monetisation** — see [PRICING.md](PRICING.md) | Planned | L |
| — | Backlog / tech debt | Ongoing | — |

**Build order from here:** **2c** (doubles as
Monetisation Stage A's enforcement point) → **Monetisation A** (plan columns,
expiry job) → **Admin portal** + **7a** → **Monetisation B** (paid plans, PayFast) → Phase 4 leftovers →
Phase 5 → Phases 6/7 (unlock Monetisation C) → the rest.

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

### Phase 2b — Stop enumeration · Size M · ✅ shipped, verified on production

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

### Phase 2c — Upload limits + delete own · Size M · 🔧 built, verified locally

- ✅ **Server-issued uploads** (`lib/uploadActions.ts`): `startPhotoUpload` checks the album is open, the type and the limits, writes an `upload_tickets` row and returns a one-time signed upload URL; the browser uploads; `finishPhotoUpload` checks the ticket, **sniffs the file's real bytes** (a non-image labelled `image/gif` is refused and deleted) and inserts the row. Direct anon storage/`photos` inserts removed (0010).
- ✅ **Rate limits** (`lib/uploadRules.ts`): 50 uploads/hour per guest id, 400/hour per network (salted IP hash; venue Wi-Fi), 3000 photos per album until plans set real caps. The host is exempt.
- ✅ **Guest id:** random id per browser (`lib/guestId.ts`); only its SHA-256 is stored (`photos.guest_hash`), never shown to others. Host uploads are `by_host` and never count as a contributor.
- ✅ **Guests delete their own photos** ("Delete my photo" in the viewer and feed), server-checked by guest hash; host removal moved to a Server Function too. Both now delete the file through the Storage API (the old RPC only removed its record).
- **Migrations:** 0009 (safe any time) before the release; 0010 (switch off direct uploads) only after the release is live.
- Later (Phase 4): delete `upload_tickets` older than a day and storage files whose upload never finished.

**Done when:** ✅ a guest over the limit is cut off; ✅ a fake image is refused; ✅ a guest can delete their own photo but not anyone else's (`tests/server-uploads.spec.ts`).

## Phase 3 — Host photo delete · Size S · 🔧 built on `host-delete`, verified locally

**Goal:** the host can remove any photo, and it disappears for everyone.

- ✅ Remove button (host only) in the story viewer header and on each feed post. Guests and wrong-token visitors never see it.
- ✅ Confirm sheet ("Remove this photo?", photo preview, **Remove for everyone** / **Keep it**); no browser pop-ups. The viewer moves on to the next photo after a removal.
- ✅ Calls `delete_event_photo(photo_id, host_token)` (live since 0004) with the verified `?t=` token; the 0007 trigger removes it live from every open album, and `/photos/<id>` returns 404.
- ✅ Works locally on `/demo?as=host` (no database), so it can be tried safely.
- ✅ Live updates are now verified in batches (one Server Function call per burst, not per photo), so a busy event can't queue up checks.
- ✅ `tests/host-delete.spec.ts`: host removes from the viewer and it disappears for a guest in another browser; feed remove + "Keep it" cancel; no remove buttons for guests / wrong token; demo removal.

**DB:** none. **Known limit:** a removed photo can stay in the image cache for up to an hour if someone saved its URL (see `app/photos/[photoId]/route.ts`); the file bytes are only purged in storage by Phase 4's cleanup job.

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

## Phase 7a — "Your albums on this device" · Size S

A no-login stopgap for *My events* until host accounts exist.
- The browser remembers every album created or opened with a valid host link (id, name, host link, date) in `localStorage`.
- The landing page shows **Your albums on this device**: cover/monogram, name, date, Live/Closed, "Open as host", and "Forget" (removes it from the list only).
- Honest limits: one device/browser only, lost if site data is cleared. The copied host link stays the real key; the host page keeps saying "save it".
- Phase 7 later imports this list when the host signs in ("claim these albums").

## Admin portal · Size M · before Monetisation B

For the developer/operator, not hosts. Needed before taking payments (support, refunds, abuse).
- **`/admin`**, signed in (decide at build time: Supabase Auth magic link limited to an `ADMIN_EMAILS` allowlist — needs `@supabase/ssr`, ask first — or a single admin password env var + signed cookie, no dependency). Never linked from the app; noindex; every page and Server Function re-checks the admin session.
- **Albums list:** every event, newest first, search by name/id, with photos, contributors, storage used, created, last upload, Live/Closed, plan (after Monetisation A).
- **Actions:** open as host (shows the host link), close/reopen uploads, **delete album** (photos rows, storage files including covers/posters, then the event; typed confirmation), delete a single photo.
- **Later:** reports queue (Phase 8), payments and refunds (Monetisation B), expiry job status.
- **Audit log** table: who did what, when.

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

## Event themes + event details · Size M · ✅ shipped

Hosts pick a preset when creating the event (changeable later): **Sunset Pop** (id `classic`, the original look), **Champagne** (`gold`, weddings; serif headings), **Rosé** (`blush`), **Midnight Gala** (`midnight`), **Garden Party** (`garden`). Names are display-only; ids are stored.
- Themes change the frame only: accent colour, background tint, heading font, cover ring and the printed QR card / table tent. Photos stay neutral.
- Presets, not a free colour picker: every theme is contrast-checked in light and dark (`tests/themes.spec.ts`).
- **Event details** (0008): cover photo / logo (cropped in the browser), poster / invitation, date, note, up to 4 https links, theme. The profile circle shows the cover or a monogram (never a guest photo) and opens an info sheet; hosts get "Edit event" and a nudge to add a cover. Saved through host-token-checked Server Functions (`lib/eventActions.ts`); images served by `/media/...`.
- **Sharing:** WhatsApp / social link previews per album, noindex on albums and host pages, A4 fold-in-half table tent print.

## Monetisation

Once-off per-event plans (Free / R149 / R399 / R799) priced by contributor
count, PayFast first. Full plan, decisions and stages in [PRICING.md](PRICING.md):
- **Stage A — Foundations:** 2c server uploads + guest ids, `events.plan` / `expires_at`, `plans` seed table, daily expiry job + reminders.
- **Stage B — Paid plans v1:** contributor cap enforced on the server, plan picker + pricing page, upgrade for the difference, `event_purchases`, PayFast checkout with verified ITN only.
- **Stage C — Needs host accounts (Phase 7):** 3-event pack, returning-host coupon, Pro subscription, co-hosts, own logo.
- **Stage D — As features are built:** video, full-res, ZIP, slideshow, highlight video, printed card packs.

## Backlog / tech debt

- **Tests:** EXIF, theme contrast and event-details validation (always), plus opt-in E2E against the local stack. Missing: running the E2E suite in CI.
- **Not-found pages return HTTP 200**, not 404, for unknown album ids: `loading.tsx` streams the page before the lookup finishes. Visitors see the right page; crawlers and monitoring see the wrong status. Fix by looking up the event before streaming (or dropping `loading.tsx` for those routes).
- **Hosted migrations are applied by hand.** Consider `npx supabase link` + `db push` so the dashboard tracks them.
- **Custom handle:** the album handle still comes from the event name.
- **Logo:** `app/icon.svg` / `app/apple-icon.tsx` are a placeholder mark; swap for the final logo.
- **Upload composer polish:** preview of picked photos, one prompt for the batch, posting progress in the feed (*Upload composer*).
- **Selfie prompt** has no demo photo yet (`lib/demoPhotos.ts`).
- **Vercel Hobby limits:** 5K image optimisations / month; watch usage once real events run.
- **Custom domain** (Vercel production checklist).
- **Videos:** the photo-limit board mentions "videos count as 3 photos"; not designed further.
