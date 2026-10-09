export type Prompt = {
  id: string;
  emoji: string;
  label: string;
};

export const PROMPTS: Prompt[] = [
  { id: "with-the-host", emoji: "🎉", label: "With the host" },
  { id: "dance-floor", emoji: "💃", label: "Dance floor moment" },
  { id: "made-you-laugh", emoji: "😂", label: "Something that made you laugh" },
  { id: "cheers", emoji: "🥂", label: "Cheers! Raise a glass" },
  { id: "best-dressed", emoji: "👗", label: "Best dressed" },
  { id: "with-friends", emoji: "🤳", label: "Selfie with your friends" },
  { id: "live-music", emoji: "🎶", label: "Live music / DJ moment" },
  { id: "candid", emoji: "📸", label: "Candid moment" },
  { id: "decor-detail", emoji: "🌸", label: "A decor detail you loved" },
  { id: "see-you-soon", emoji: "👋", label: "Say your goodbyes" },
  { id: "group-photo", emoji: "📷", label: "Group photo" },
];

export function getPromptById(id: string | null | undefined): Prompt | undefined {
  if (!id) return undefined;
  return PROMPTS.find((p) => p.id === id);
}
