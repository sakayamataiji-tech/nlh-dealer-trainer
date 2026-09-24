"use client";
import type { ReactNode } from "react";
import { FastForward, RotateCcw } from "lucide-react";
import type { ActionType, Street } from "@/engine/actions";
import type { PlaybackFrame } from "@/engine/playback";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { statsStore, useStats } from "@/lib/statsStore";
import { cn } from "@/lib/utils";

export const STREET_LABEL: Record<Street, string> = { preflop: "PREFLOP", flop: "FLOP", turn: "TURN", river: "RIVER" };
const ACTION_WORD: Partial<Record<ActionType, string>> = { fold: "FOLD", check: "CHECK", call: "CALL", bet: "BET", raise: "RAISE", allin: "ALL-IN" };

/** SKIP / REPLAY and 1–3x speed for hand playback. */
export function ReplayControls({ done, skip, replay }: { done: boolean; skip: () => void; replay: () => void }) {
  const speed = useStats()?.settings.playbackSpeed ?? 1;
  return (
    <Panel className="p-3 sm:p-4">
      <div className="flex items-center gap-2">
        {!done ? (
          <Button size="sm" variant="secondary" onClick={skip}>
            <FastForward className="h-4 w-4" /> SKIP
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={replay}>
            <RotateCcw className="h-4 w-4" /> REPLAY
          </Button>
        )}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-line">
          {([1, 2, 3] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => statsStore.setPlaybackSpeed(s)}
              className={cn("h-9 w-11 text-xs font-bold", s === speed ? "bg-brass/15 text-brass" : "text-muted hover:text-text")}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function usePlaybackSpeed(): number {
  return useStats()?.settings.playbackSpeed ?? 1;
}

/** One seat during playback: position, cards (backs / face-up / none when folded), action badge. */
export function PlaybackSeat({
  id,
  label,
  view,
  done,
  cards,
  highlight = false,
}: {
  id: string;
  label: string;
  view: PlaybackFrame;
  done: boolean;
  cards: ReactNode;
  highlight?: boolean;
}) {
  const folded = view.folded.includes(id);
  const allIn = view.allIn.includes(id);
  const acting = view.actor === id && !done;
  const word = acting && view.actionType ? ACTION_WORD[view.actionType] : view.returnedTo === id ? "RETURN" : null;
  return (
    <div
      className={cn(
        "relative flex min-w-14 flex-col items-center gap-0.5 rounded-lg border border-line bg-ink/90 px-2 py-1 transition-opacity",
        folded && "opacity-40",
        acting && "border-brass ring-2 ring-brass/60",
        highlight && "border-brass bg-brass/20 ring-2 ring-brass",
      )}
    >
      <div className={cn("whitespace-nowrap text-[11px] font-bold tracking-wider", highlight && "text-brass")}>{label}</div>
      {!folded && cards}
      {allIn && <div className="text-[9px] font-black tracking-[0.2em] text-bad">ALL-IN</div>}
      {word && (
        <div className={cn("animate-pop absolute -top-3 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest", word === "FOLD" ? "bg-line text-muted" : word === "ALL-IN" ? "bg-bad text-ink" : "bg-brass text-ink")}>
          {word}
        </div>
      )}
    </div>
  );
}
