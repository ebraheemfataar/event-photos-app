---
description: Add a new photo prompt/idea chip to lib/prompts.ts, this app's fixed list of guest photo suggestions. Use when asked to add, rename, or remove a photo prompt.
argument-hint: [label] [emoji]
---

## Task

Add a new entry to the `PROMPTS` array in `lib/prompts.ts`, the fixed list of tappable photo-idea chips shown to guests in `PromptChips`.

## Conventions to follow (read `lib/prompts.ts` first to confirm)

- Each entry is `{ id, emoji, label }`.
- `id`: kebab-case slug derived from the label (e.g. "Group photo" → `group-photo`). Must not collide with an existing id in the file.
- `emoji`: a single emoji matching the label.
- `label`: short and generic — this app is used for any kind of event, not just weddings, so avoid wording tied to one event type (no "bride", "groom", etc.) unless the user explicitly asks for it. Match the tone of existing entries like "Dance floor moment" or "Something that made you laugh".

## Steps

1. Read `lib/prompts.ts` to see the current entries and avoid an id collision.
2. Parse `$ARGUMENTS` for the requested label and (optionally) an emoji. If no emoji is given, pick one that fits the label. If the label doesn't fit the generic/kebab-case conventions above, adjust it to fit rather than inserting it verbatim.
3. Append the new entry to the end of the `PROMPTS` array — don't reorder or edit existing entries.
4. Don't touch any other file; this is a self-contained content change.
5. Show the user the new entry you added.
