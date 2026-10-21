# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config via `eslint.config.*`, uses `eslint-config-next`)
- `npx tsc --noEmit` — type-check (no dedicated `typecheck` script exists)

There is no test suite/framework configured in this repo.

**Local database (Supabase CLI, needs Docker running):**
- `npm run db:start` — start the local stack (API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`); applies every migration + `supabase/seed.sql` on first start
- `npm run db:env` — write `.env.development.local` from the running stack, so `npm run dev` uses the local DB (delete that file to point dev back at the hosted project)
- `npm run db:reset` — rebuild the local DB from migrations + seed
- `npm run db:stop` — stop the stack

Database migrations live in `supabase/migrations/*.sql`. Locally they're applied by the CLI; for the hosted project they're applied manually (SQL editor, or `npx supabase link` then `npx supabase db push`). Production uses `.env.local` / the host's env vars. The seed is local-only and gives a fixed event: guest `/e/00000000-0000-4000-8000-000000000001`, host `/host/00000000-0000-4000-8000-000000000001?t=00000000-0000-4000-8000-0000000000aa`.

`/demo` is a static mock album (no Supabase) using `lib/demoPhotos.ts`; `?as=host` and `?empty=1` show the other states.

## Architecture

**No backend.** There are no API routes (`app/api` doesn't exist). Every read/write goes directly from React components (server or client) to Supabase via `lib/supabase/client.ts` (`createSupabaseClient()`, a module-level singleton around `@supabase/supabase-js`). Authorization is enforced entirely by Postgres Row Level Security policies defined in `supabase/migrations/`, since there is no server layer to guard access.

**Auth model is a bearer token in the URL, not real auth.** `events.host_token` is a random UUID generated on event creation. Since `0003_lock_down_host_token.sql`, anon can't select `host_token` or insert into `events` directly: `CreateEventForm` calls the `create_event` RPC (the only place the token is returned) and redirects to `/host/[id]?t=<host_token>`, and `app/host/[id]/page.tsx` checks the `t` param with the `is_event_host` RPC. Anyone with the host URL has host access. Guests only ever see `/e/[id]` (no token). Never add `host_token` back to an `events` select — it errors.

**Core data flow:**
- `app/page.tsx` → `CreateEventForm` → inserts into `events`, redirects to the host URL.
- `app/host/[id]/page.tsx` (server component) → fetches the event + photos, renders `QRCodeCard` (QR pointing at the guest URL) and `PhotoGallery`.
- `app/e/[id]/page.tsx` (server component) → renders `PhotoUploadForm` + `PhotoGallery` for guests.
- `PhotoUploadForm` compresses images client-side (`lib/compressImage.ts`, via `browser-image-compression`), uploads to the `event-photos` Storage bucket, then inserts a row into `photos`.
- `PhotoGallery` opens a Supabase Realtime channel (`postgres_changes` on `photos` INSERT scoped to `event_id`) so new uploads appear live for everyone viewing that event, and renders `PhotoGrid` (grid + lightbox).

**Styling: Tailwind CSS v4, config-free.** There is no `tailwind.config.js/ts` — everything is configured in `app/globals.css` via `@import "tailwindcss"` and `@theme inline`. Dark mode is class-based: `@custom-variant dark (&:where(.dark, .dark *));` repoints the `dark:` variant at a `.dark` class (rather than v3-style `darkMode: 'class'` config). The `.dark` class is toggled on `<html>` by `components/ThemeToggle.tsx` and persisted to `localStorage`; a `beforeInteractive` inline script in `app/layout.tsx` applies it before hydration to avoid a flash of the wrong theme (`<html>` has `suppressHydrationWarning` because of this).

**Photo prompts are a fixed, code-defined list**, not database-backed: `lib/prompts.ts` exports `PROMPTS` (id/emoji/label) and `getPromptById`. A guest's chip selection in `PromptChips` is stored as plain text in `photos.prompt_id` (no FK, added in `supabase/migrations/0002_add_photo_prompts.sql`) and looked back up via `getPromptById` wherever it's displayed (`PhotoGrid`).

**Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.local.example`). Both are public/anon-scoped by design — RLS is what actually protects the data.
