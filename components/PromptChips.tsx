"use client";

import { PROMPTS } from "@/lib/prompts";

export default function PromptChips({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Photo idea (optional)
      </span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PROMPTS.map((prompt) => {
          const isSelected = prompt.id === selectedId;
          return (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : prompt.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span>{prompt.emoji}</span>
              <span>{prompt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
