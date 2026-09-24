import { type Card, isRed, rankLabel, rankValue, SUIT_SYMBOL, suitOf } from "@/engine/cards";
import { cn } from "@/lib/utils";

export type CardSize = "xs" | "sm" | "md" | "lg";

const SIZE: Record<CardSize, { box: string; rank: string; corner: string; pip: string }> = {
  xs: { box: "w-7 h-10 rounded-[4px]", rank: "text-[13px]", corner: "text-[10px]", pip: "text-[13px]" },
  sm: { box: "w-9 h-[3.25rem] sm:w-10 sm:h-14 rounded-md", rank: "text-base sm:text-lg", corner: "text-xs", pip: "text-lg sm:text-xl" },
  md: { box: "w-11 h-[3.9rem] sm:w-14 sm:h-20 rounded-md", rank: "text-xl sm:text-2xl", corner: "text-sm sm:text-base", pip: "text-2xl sm:text-3xl" },
  lg: { box: "w-14 h-20 sm:w-[4.6rem] sm:h-[6.4rem] rounded-lg", rank: "text-2xl sm:text-[2rem]", corner: "text-base sm:text-lg", pip: "text-3xl sm:text-[2.6rem]" },
};

/** Real-deck style card: big rank + suit, red hearts/diamonds, black spades/clubs. */
export function PlayingCard({ card, size = "md", dim = false, highlight = false, className }: { card: Card; size?: CardSize; dim?: boolean; highlight?: boolean; className?: string }) {
  const s = SIZE[size];
  const red = isRed(card);
  const label = rankLabel(rankValue(card));
  return (
    <div
      className={cn(
        "relative shrink-0 select-none border border-black/20 bg-card shadow-[0_2px_4px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150",
        s.box,
        red ? "text-suit-red" : "text-suit-black",
        dim && "opacity-35",
        highlight && "-translate-y-1 ring-2 ring-brass ring-offset-1 ring-offset-transparent",
        className,
      )}
      aria-label={`${label}${SUIT_SYMBOL[suitOf(card)]}`}
    >
      <div className={cn("absolute left-[8%] top-[3%] flex flex-col items-center leading-none font-bold", s.corner)} style={{ fontFamily: "var(--font-card)" }}>
        <span className={cn(s.rank, label === "10" && "tracking-[-0.08em]")}>{label}</span>
        <span className="-mt-[1px]">{SUIT_SYMBOL[suitOf(card)]}</span>
      </div>
      <div className={cn("absolute bottom-[6%] right-[10%] leading-none", s.pip)}>{SUIT_SYMBOL[suitOf(card)]}</div>
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: CardSize }) {
  return (
    <div className={cn("shrink-0 border border-black/40 bg-[repeating-linear-gradient(45deg,#6b1d22_0_4px,#7d252b_4px_8px)] shadow", SIZE[size].box)} />
  );
}

export function CardRow({ cards, size = "md", highlight, dimOthers = false, className }: { cards: Card[]; size?: CardSize; highlight?: readonly Card[]; dimOthers?: boolean; className?: string }) {
  return (
    <div className={cn("flex gap-1 sm:gap-1.5", className)}>
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} highlight={!!highlight && highlight.includes(c)} dim={dimOthers && !!highlight && !highlight.includes(c)} />
      ))}
    </div>
  );
}
