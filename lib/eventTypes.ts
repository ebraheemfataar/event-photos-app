// Kinds of event, picked when the album is created (and editable later).
// The ids are stored in `events.event_type` and fixed by a check constraint
// (0016); labels and emoji can change freely.

export const EVENT_TYPES = [
  { id: "wedding", label: "Wedding", emoji: "💍" },
  { id: "engagement", label: "Engagement", emoji: "💐" },
  { id: "birthday", label: "Birthday", emoji: "🎂" },
  { id: "baby_shower", label: "Baby shower", emoji: "🍼" },
  { id: "graduation", label: "Graduation", emoji: "🎓" },
  { id: "corporate", label: "Corporate", emoji: "💼" },
  { id: "party", label: "Party", emoji: "🎉" },
  { id: "other", label: "Other", emoji: "✨" },
] as const;

export type EventTypeId = (typeof EVENT_TYPES)[number]["id"];

export function isEventType(value: unknown): value is EventTypeId {
  return EVENT_TYPES.some((t) => t.id === value);
}

export function eventTypeLabel(id: string | null | undefined): string | null {
  return EVENT_TYPES.find((t) => t.id === id)?.label ?? null;
}
