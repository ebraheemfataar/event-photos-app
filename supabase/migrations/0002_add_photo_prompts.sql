-- Photo prompts: optional tagging of photos against a fixed, curated list of
-- prompts defined in code (lib/prompts.ts). Not a DB-backed lookup table for
-- v1 — prompt_id is a plain string id, validated only for length here.
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).

alter table public.photos
  add column prompt_id text check (char_length(prompt_id) <= 40);
