"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface Choice {
  key: string;
  label: string;
}

/** Numbered answer buttons; keys 1–9 answer immediately (choice modes only). */
export function ChoiceList({
  choices,
  onPick,
  answeredKey,
  correctKey,
  columns = 2,
}: {
  choices: Choice[];
  onPick: (key: string) => void;
  answeredKey: string | null;
  correctKey: string | null;
  columns?: 1 | 2;
}) {
  const locked = answeredKey !== null;
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 9 && n <= choices.length) {
        e.preventDefault();
        onPick(choices[n - 1].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onPick, locked]);

  return (
    <div className={cn("grid gap-1.5", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {choices.map((c, i) => {
        const isCorrect = locked && c.key === correctKey;
        const isWrongPick = locked && c.key === answeredKey && c.key !== correctKey;
        return (
          <button
            key={c.key}
            type="button"
            disabled={locked}
            onClick={() => onPick(c.key)}
            className={cn(
              "group flex h-11 items-center gap-2 rounded-lg border px-2 text-left text-sm font-semibold leading-tight transition-colors lg:h-10",
              "border-line bg-panel-2 hover:border-brass-dim active:bg-line",
              locked && "cursor-default hover:border-line",
              isCorrect && "border-good bg-good/15 text-good hover:border-good",
              isWrongPick && "border-bad bg-bad/15 text-bad hover:border-bad",
              locked && !isCorrect && !isWrongPick && "opacity-45",
            )}
          >
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink font-mono text-xs text-muted", isCorrect && "text-good", isWrongPick && "text-bad")}>{i + 1}</span>
            <span className="min-w-0">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
