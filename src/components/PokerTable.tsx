import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Oval table seen from the dealer's chair: the dealer (user) sits at the bottom centre,
 * players are placed along the far arc. Seat content is provided by the caller.
 */
export function PokerTable({ center, seats, className, compact = false }: { center: ReactNode; seats: ReactNode[]; className?: string; compact?: boolean }) {
  const n = seats.length;
  const positions = seatPositions(n);
  const mobileCols = n === 1 ? "grid-cols-1" : n === 2 || n === 4 ? "grid-cols-2" : "grid-cols-3";
  return (
    <>
      {/* Phones: players across the table in a grid, felt with the board below, dealer at the bottom. */}
      <div className={cn("flex w-full flex-col gap-2 sm:hidden", className)}>
        <div className={cn("grid place-items-center gap-2", mobileCols)}>{seats}</div>
        <div className="felt flex min-h-28 flex-col items-center justify-center gap-2 rounded-[2rem] border-4 border-rail px-2 py-4 shadow-[0_0_0_1px_#3a2718]">{center}</div>
        <div className="mx-auto rounded-full border border-brass-dim/60 bg-ink/80 px-3 py-0.5 text-[10px] font-bold tracking-[0.25em] text-brass">DEALER</div>
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
