# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config via `eslint.config.*`, uses `eslint-config-next`)
- `npx tsc --noEmit` — type-check (no dedicated `typecheck` script exists)

- `npm test` — Playwright tests in `tests/`, run in the locally installed Google Chrome. `exif.spec.ts` (always runs) checks that photo compression strips EXIF/GPS. `upload.spec.ts` (guest uploads, GIFs) and `security.spec.ts` (no anon listing, private bucket, forged-broadcast handling, host/guest pages) run end-to-end against the local stack; they're skipped unless you set `E2E_BASE_URL=http://localhost:3000` with `npm run db:start`, `npm run db:env` and `npm run dev` running. Never point it at production.

Photo compression settings live in `lib/compressOptions.ts`. GIFs (`PASSTHROUGH_TYPES`) skip compression so they stay animated; they're capped at `MAX_UPLOAD_BYTES` (10 MB, matching the bucket limit) and larger ones are skipped with a message. Videos aren't supported yet. The library's web worker loads from `public/vendor/browser-image-compression@2.0.2.js` (not a CDN); `browser-image-compression` is pinned to exactly that version in `package.json`, so when upgrading it, copy the new `dist/browser-image-compression.js` into `public/vendor/` under the new version name and update `COMPRESSION_WORKER_URL`.

**Local database (Supabase CLI, needs Docker running):**
- `npm run db:start` — start the local stack (API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`); applies every migration + `supabase/seed.sql` on first start
- `npm run db:env` — write `.env.development.local` from the running stack, so `npm run dev` uses the local DB (delete that file to point dev back at the hosted project)
- `npm run db:reset` — rebuild the local DB from migrations + seed
- `npm run db:stop` — stop the stack

Database migrations live in `supabase/migrations/*.sql`. Locally they're applied by the CLI; for the hosted project they're applied manually (SQL editor, or `npx supabase link` then `npx supabase db push`). Production uses `.env.local` / the host's env vars. The seed is local-only and gives a fixed event: guest `/e/00000000-0000-4000-8000-000000000001`, host `/host/00000000-0000-4000-8000-000000000001?t=00000000-0000-4000-8000-0000000000aa`.

`/demo` is a static mock album (no Supabase) using `lib/demoPhotos.ts`; `?as=host` and `?empty=1` show the other states.

## Architecture

**Reads go through the server; writes go straight to Supabase.** Since `0007_lock_down_reads.sql`, the anon key can't read `events` or `photos` at all, and the `event-photos` bucket is private — otherwise anyone with the public anon key could list every event's photos. So:
- **Reads** use the service-role client in `lib/supabase/server.ts` (`createServiceClient()`, guarded by `import "server-only"`) via the helpers in `lib/data.ts`, which always scope to an id from the request (`getEvent`, `getEventPhotos`, `getEventPhoto`, `getPhotoFile`). "Knowing the link grants access" is enforced there. Never add a read that isn't scoped to a request id, and never select `host_token`.
- **Photos** are served by `app/photos/[photoId]/route.ts` (downloads from the private bucket, 1 h cache, `nosniff`). Use `photoSrc(photo)` from `lib/photoSrc.ts` for any `<Image src>`; demo/seed rows store a full https URL and are loaded directly. `next.config.ts` only allows `/photos/**` locally and Unsplash remotely.
- **Writes** still use the anon client in `lib/supabase/client.ts` (`createSupabaseClient()`), guarded by RLS: the `create_event` / `delete_event_photo` RPCs, anon storage upload and anon `photos` insert (both policies call the SECURITY DEFINER helper `event_is_active`).

**Auth model is a bearer token in the URL, not real auth.** `events.host_token` is a random UUID generated on event creation. Since `0003_lock_down_host_token.sql`, anon can't select `host_token` or insert into `events` directly: `CreateEventForm` calls the `create_event` RPC (the only place the token is returned) and redirects to `/host/[id]?t=<host_token>`, and `app/host/[id]/page.tsx` checks the `t` param with the `is_event_host` RPC. Anyone with the host URL has host access. Guests only ever see `/e/[id]` (no token). Never add `host_token` back to an `events` select — it errors.

**Core data flow:**
- `app/page.tsx` → `CreateEventForm` → `create_event` RPC, redirects to the host URL.
- `app/host/[id]/page.tsx` and `app/e/[id]/page.tsx` (server components) → `getEvent` + `getEventPhotos`, render `PhotoGallery` → `EventAlbum` (profile, QR card for hosts, grid/feed, story viewer, upload sheet).
- `PhotoUploadForm` compresses images client-side (`lib/compressImage.ts`; GIFs pass through), uploads to the `event-photos` bucket, then inserts a row into `photos`.
- **Live updates:** a trigger on `photos` (`broadcast_photo_change`, 0007) sends only `{id}` as a Realtime **Broadcast** (`photo_inserted` / `photo_deleted`) on the public topic `event:<event id>`. `PhotoGallery` subscribes to that channel and, because anyone can send on a public channel, verifies every message by calling the Server Function `fetchEventPhoto` (`lib/photoActions.ts`) before adding or removing a photo. `postgres_changes` is not used (it needs anon SELECT).

**Styling: Tailwind CSS v4, config-free.** There is no `tailwind.config.js/ts` — everything is configured in `app/globals.css` via `@import "tailwindcss"` and `@theme inline`. Dark mode is class-based: `@custom-variant dark (&:where(.dark, .dark *));` repoints the `dark:` variant at a `.dark` class (rather than v3-style `darkMode: 'class'` config). The `.dark` class is toggled on `<html>` by `components/ThemeToggle.tsx` and persisted to `localStorage`; a `beforeInteractive` inline script in `app/layout.tsx` applies it before hydration to avoid a flash of the wrong theme (`<html>` has `suppressHydrationWarning` because of this).

**Photo prompts are a fixed, code-defined list**, not database-backed: `lib/prompts.ts` exports `PROMPTS` (id/emoji/label) and `getPromptById`. A guest's chip selection in `PromptChips` is stored as plain text in `photos.prompt_id` (no FK, added in `supabase/migrations/0002_add_photo_prompts.sql`) and looked back up via `getPromptById` wherever it's displayed (`PhotoGrid`).

**Env vars** (see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public by design (writes are protected by RLS). `SUPABASE_SERVICE_ROLE_KEY` is a **secret** that bypasses RLS: server-only, never `NEXT_PUBLIC_`, a Sensitive variable on Vercel. `npm run db:env` writes the local stack's (non-secret) one into `.env.development.local`.
