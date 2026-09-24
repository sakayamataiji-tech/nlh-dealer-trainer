"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface Choice {
  key: string;
  label: string;
  /** Keyboard shortcut; defaults to its 1-based position (1–9). */
  hotkey?: string;
}

/** Numbered answer buttons; digit keys answer immediately (choice modes only). */
export function ChoiceList({
  choices,
  onPick,
  answeredKey,
  correctKey,
  pendingKey = null,
  columns = 2,
}: {
  choices: Choice[];
  onPick: (key: string) => void;
  /** Final answer (reveals right / wrong). */
  answeredKey: string | null;
  correctKey: string | null;
  /** Picked but not yet graded (e.g. waiting for the board-card step): locked, no reveal. */
  pendingKey?: string | null;
  columns?: 1 | 2;
}) {
  const locked = answeredKey !== null || pendingKey !== null;
  const keyOf = (c: Choice, i: number) => c.hotkey ?? String(i + 1);
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = choices.findIndex((c, i) => keyOf(c, i) === k || (c.key === "SPLIT" && k === "s"));
      if (idx >= 0) {
        e.preventDefault();
        onPick(choices[idx].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onPick, locked]);

  return (
    <div className={cn("grid gap-1.5", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {choices.map((c, i) => {
        const revealed = answeredKey !== null;
        const isCorrect = revealed && c.key === correctKey;
        const isWrongPick = revealed && c.key === answeredKey && c.key !== correctKey;
        const isPending = !revealed && c.key === pendingKey;
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
              isPending && "border-brass bg-brass/15 text-brass hover:border-brass",
              isCorrect && "border-good bg-good/15 text-good hover:border-good",
              isWrongPick && "border-bad bg-bad/15 text-bad hover:border-bad",
              locked && !isCorrect && !isWrongPick && !isPending && "opacity-45",
            )}
          >
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink font-mono text-xs text-muted", isCorrect && "text-good", isWrongPick && "text-bad", isPending && "text-brass")}>
              {keyOf(c, i)}
            </span>
            <span className="min-w-0">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
