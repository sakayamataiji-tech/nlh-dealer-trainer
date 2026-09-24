"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import type { Card } from "@/engine/cards";
import { CardRow, PlayingCard, type CardSize } from "@/components/PlayingCard";
import { Button } from "@/components/ui/button";
import { Kbd, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * Shared "push up the board cards that play" step (HAND READING and WINNER).
 * Keys while active: 1–5 toggle board cards, Enter confirms, Esc / Backspace goes back.
 */
export function useBoardCardStep(board: readonly Card[], active: boolean, onSubmit: (cards: Card[]) => void, onBack: () => void) {
  const [raised, setRaised] = useState<Card[]>([]);
  const toggle = useCallback((c: Card) => setRaised((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])), []);
  const reset = useCallback(() => setRaised([]), []);
  const canSubmit = raised.length >= 3 && raised.length <= 5;
  const submit = useCallback(() => {
    if (raised.length >= 3 && raised.length <= 5) onSubmit(board.filter((c) => raised.includes(c)));
  }, [raised, board, onSubmit]);
  const back = useCallback(() => {
    setRaised([]);
    onBack();
  }, [onBack]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= board.length) {
        e.preventDefault();
        toggle(board[n - 1]);
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, board, toggle, submit, back]);

  return { raised, toggle, reset, canSubmit, submit, back };
}

/** The board; cards are tappable (and rise when selected) while `interactive`. */
export function BoardCards({
  board,
  raised,
  interactive,
  onToggle,
  size = "lg",
}: {
  board: readonly Card[];
  raised: readonly Card[];
  interactive: boolean;
  onToggle: (c: Card) => void;
  size?: CardSize;
}) {
  return (
    <div className="flex gap-1 pt-3 sm:gap-1.5">
      {board.map((c, i) => {
        const up = raised.includes(c);
        const card = <PlayingCard card={c} size={size} highlight={up} className={cn(up && "-translate-y-3")} />;
        return interactive ? (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brass"
            aria-pressed={up}
            aria-label={`board card ${i + 1}`}
          >
            {card}
            <span className="absolute -bottom-4 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] text-text/60 md:block">{i + 1}</span>
          </button>
        ) : (
          <div key={c}>{card}</div>
        );
      })}
    </div>
  );
}

/** Collapsed first answer ("HAND: Straight  [変更]") shown during the card step. */
export function PickedSummary({ label, value, onBack }: { label: string; value: ReactNode; onBack: () => void }) {
  return (
    <Panel className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
      <div className="text-sm">
        <span className="text-muted">{label}: </span>
        <span className="font-bold text-brass">{value}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <Undo2 className="h-4 w-4" /> 変更 <Kbd>Esc</Kbd>
      </Button>
    </Panel>
  );
}

/** Instruction + confirm button; scrolls itself into view on phones. */
export function CardStepPanel({ title, count, canSubmit, onSubmit }: { title: ReactNode; count: number; canSubmit: boolean; onSubmit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);
  return (
    <div ref={ref}>
      <Panel className="animate-rise border-brass/50 p-3 sm:p-4">
        <div className="text-lg font-bold tracking-wide sm:text-xl">{title}</div>
        <div className="mt-0.5 text-xs text-muted">役に使われるコミュニティカードをタップして上げる（3〜5枚）</div>
        <Button variant="primary" size="lg" className="mt-3 w-full" disabled={!canSubmit} onClick={onSubmit}>
          決定（{count}枚） <Kbd className="border-ink/30 bg-transparent text-ink/70">Enter</Kbd>
        </Button>
        <div className="mt-1 hidden text-[11px] text-muted md:block">1〜5: ボードのカードを上げ下げ · Esc: 前の選択に戻る</div>
      </Panel>
    </div>
  );
}

/** Result rows: which part was right, plus a correct example for the cards. */
export function PartsResult({ rows, example }: { rows: { ok: boolean; label: string; value: ReactNode }[]; example?: { label: string; cards: Card[] } }) {
  return (
    <div className="mb-3 grid gap-1 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className={cn("w-4 shrink-0 text-center font-black", r.ok ? "text-good" : "text-bad")}>{r.ok ? "✓" : "×"}</span>
          <span className="w-28 shrink-0 text-xs font-bold tracking-widest text-muted">{r.label}</span>
          <span className={cn("font-semibold", r.ok ? "text-good" : "text-bad")}>{r.value}</span>
        </div>
      ))}
      {example && (
        <div className="flex items-center gap-2 pl-6 text-xs text-muted">
          {example.label} <CardRow cards={example.cards} size="xs" />
        </div>
      )}
    </div>
  );
}
