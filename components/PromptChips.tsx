"use client";

import { PROMPTS } from "@/lib/prompts";
import { promptSwatch } from "@/lib/display";

export default function PromptChips({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <span className="mono text-[10px] text-ink-3">Prompt · optional</span>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {PROMPTS.map((prompt) => {
          const isSelected = prompt.id === selectedId;
          const swatch = promptSwatch(prompt.id);
          return (
            <button
              key={prompt.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : prompt.id)}
              className={`flex min-h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border py-1.5 pl-[5px] pr-3.5 text-sm font-medium transition-[background-color,transform] active:scale-[0.94] ${
                isSelected
                  ? "border-btn bg-btn text-btn-ink"
                  : "border-line-strong bg-surface text-ink hover:bg-surface-3"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                style={{ background: swatch.bg }}
              >
                {prompt.emoji}
              </span>
              {prompt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
