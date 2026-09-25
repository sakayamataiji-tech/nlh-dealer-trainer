import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Oval table seen from the dealer's chair: the dealer (user) sits at the bottom centre,
 * players are placed along the far arc. Seat content is provided by the caller.
 */
export function PokerTable({
  center,
  seats,
  bets,
  collecting = false,
  className,
  compact = false,
  hideMobileFelt = false,
  hideOnMobile,
}: {
  center: ReactNode;
  seats: ReactNode[];
  /** Chips in front of each seat (between the seat and the pot). */
  bets?: (ReactNode | null)[];
  /** Animate the bets sliding into the pot. */
  collecting?: boolean;
  className?: string;
  compact?: boolean;
  hideMobileFelt?: boolean;
  /** Seats to leave out of the compact phone layout (e.g. folded players at showdown). */
  hideOnMobile?: boolean[];
}) {
  const n = seats.length;
  const positions = seatPositions(n);
  const mobileIdx = seats.map((_, i) => i).filter((i) => !hideOnMobile?.[i]);
  const m = mobileIdx.length;
  const mobileCols = m === 1 ? "grid-cols-1" : m === 2 || m === 4 ? "grid-cols-2" : "grid-cols-3";
  return (
    <>
      {/* Phones: players across the table in a grid, felt with the board below, dealer at the bottom. */}
      <div className={cn("flex w-full flex-col gap-2 sm:hidden", className)}>
        <div className={cn("grid place-items-center gap-2", mobileCols)}>
          {mobileIdx.map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {seats[i]}
              {bets?.[i] && <div className={cn("transition-all duration-500", collecting && "translate-y-6 opacity-0")}>{bets[i]}</div>}
            </div>
          ))}
        </div>
        {!hideMobileFelt && (
        <div className="felt flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-[2rem] border-4 border-rail px-2 py-2.5 shadow-[0_0_0_1px_#3a2718]">{center}</div>
        )}
        {!hideMobileFelt && <div className="mx-auto rounded-full border border-brass-dim/60 bg-ink/80 px-3 py-0.5 text-[10px] font-bold tracking-[0.25em] text-brass">DEALER</div>}
      </div>
    <div className={cn("relative mx-auto hidden w-full sm:block", compact ? "aspect-[2/1.05]" : n >= 5 ? "aspect-[2/1.22]" : "aspect-[2/1.02]", className)}>
      <div className="felt rail absolute inset-x-[4%] inset-y-[10%] rounded-[50%] border border-felt-line/40">
        <div className="absolute inset-[7%] rounded-[50%] border border-felt-line/30" />
      </div>
      <div className="absolute inset-x-[16%] top-[30%] bottom-[24%] flex flex-col items-center justify-center gap-2">{center}</div>
      {seats.map((seat, i) => (
        <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}>
          {seat}
        </div>
      ))}
      {bets?.map((bet, i) => {
        if (!bet) return null;
        // In front of the seat: 40% of the way towards the pot; slides to the pot when collecting.
        const t = collecting ? 1 : 0.4;
        const x = positions[i].x + (50 - positions[i].x) * t;
        const y = positions[i].y + (50 - positions[i].y) * t;
        return (
          <div
            key={`b${i}`}
            className={cn("absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in", collecting && "opacity-0")}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {bet}
          </div>
        );
      })}
      <div className="absolute bottom-[1%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-brass-dim/60 bg-ink/80 px-3 py-0.5 text-[10px] font-bold tracking-[0.25em] text-brass">
        DEALER
      </div>
    </div>
    </>
  );
}

/** Seats along the upper/side arc of an ellipse, leaving the bottom centre for the dealer. */
export function seatPositions(n: number): { x: number; y: number }[] {
  if (n === 1) return [{ x: 50, y: 12 }];
  // Wider arc for bigger tables so neighbouring seats do not collide.
  const spread = n <= 3 ? 20 : n <= 5 ? 28 : 36;
  const start = 180 + spread; // degrees, left side below centre
  const end = -spread; // right side below centre
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const deg = start + (end - start) * t;
    const rad = (deg * Math.PI) / 180;
    out.push({ x: 50 + 43 * Math.cos(rad), y: 50 - 40 * Math.sin(rad) });
  }
  return out;
}
