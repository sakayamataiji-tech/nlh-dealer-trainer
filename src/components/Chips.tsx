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
