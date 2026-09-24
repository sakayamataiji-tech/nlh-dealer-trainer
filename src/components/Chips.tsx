import { cn, formatChips } from "@/lib/utils";

/** Compact chip-stack marker with an amount, used for bets and pots. */
export function ChipAmount({ amount, tone = "brass", className, label }: { amount: number; tone?: "brass" | "red" | "blue" | "muted"; className?: string; label?: string }) {
  const color = { brass: "bg-brass border-[#f1d898]", red: "bg-[#a8232a] border-[#e3777c]", blue: "bg-[#1f4f8f] border-[#7aa6e0]", muted: "bg-[#4b544f] border-[#8d978f]" }[tone];
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full bg-black/45 py-0.5 pl-0.5 pr-2.5 text-sm font-semibold tabular", className)}>
      <span className={cn("h-4 w-4 rounded-full border-2 border-dashed", color)} />
      {label && <span className="text-[10px] font-bold tracking-wider text-muted">{label}</span>}
      <span>{formatChips(amount)}</span>
    </div>
  );
}

/** Bet marker placed in front of a seat on the table. */
export function BetBadge({ amount, label, tone = "brass", size = "md" }: { amount: number; label?: string; tone?: "brass" | "muted"; size?: "sm" | "md" }) {
  return (
    <div
      key={amount}
      className={cn(
        "animate-pop inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black/40 bg-ink/90 py-0.5 pl-0.5 pr-2 font-bold tabular shadow-[0_2px_6px_rgba(0,0,0,0.5)]",
        size === "sm" ? "text-xs" : "text-sm sm:text-base",
      )}
    >
      <span className={cn("shrink-0 rounded-full border-2 border-dashed", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", tone === "brass" ? "border-[#f1d898] bg-brass" : "border-[#8d978f] bg-[#4b544f]")} />
      {label && <span className="text-[10px] tracking-wider text-muted">{label}</span>}
      <span>{formatChips(amount)}</span>
    </div>
  );
}
