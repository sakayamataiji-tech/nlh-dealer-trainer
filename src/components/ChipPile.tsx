import { DENOMINATIONS, type ChipCounts, type Denomination } from "@/engine/chips";
import { cn } from "@/lib/utils";

/** Chip colours (edge stripes are white), recognisable at a glance. */
export const CHIP_STYLE: Record<Denomination, { base: string; edge: string; label: string }> = {
  25: { base: "#1f8a4c", edge: "#f1f1f1", label: "25" },
  100: { base: "#1b1b1b", edge: "#f1f1f1", label: "100" },
  500: { base: "#6d3fa6", edge: "#f1f1f1", label: "500" },
  1000: { base: "#e2b42a", edge: "#3a2a05", label: "1K" },
  5000: { base: "#c53030", edge: "#f1f1f1", label: "5K" },
  25000: { base: "#2f6fd6", edge: "#f1f1f1", label: "25K" },
  100000: { base: "#e87b1e", edge: "#1b1b1b", label: "100K" },
};

const SIZES = {
  sm: { w: 18, h: 6, step: 3 },
  md: { w: 24, h: 8, step: 4 },
  lg: { w: 30, h: 10, step: 5 },
} as const;
export type ChipSize = keyof typeof SIZES;

/** Dealers stack chips by colour in fives so they can be counted at a glance. */
export const CHIPS_PER_STACK = 5;

function Chip({ d, size, top }: { d: Denomination; size: ChipSize; top: boolean }) {
  const s = SIZES[size];
  const c = CHIP_STYLE[d];
  return (
    <div
      className={cn("absolute left-0 rounded-[50%] border", d === 100 ? "border-white/45" : "border-black/50")}
      style={{
        width: s.w,
        height: s.h,
        background: top
          ? `radial-gradient(ellipse at center, ${c.base} 0 45%, ${c.edge} 46% 52%, ${c.base} 53%)`
          : `repeating-linear-gradient(90deg, ${c.base} 0 ${s.w / 6}px, ${c.edge} ${s.w / 6}px ${s.w / 6 + 2}px)`,
        boxShadow: "0 1px 0 rgba(0,0,0,0.55)",
      }}
    />
  );
}

function Column({ d, n, size }: { d: Denomination; n: number; size: ChipSize }) {
  const s = SIZES[size];
  return (
    <div className="relative shrink-0" style={{ width: s.w, height: s.h + (n - 1) * s.step }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="absolute left-0" style={{ bottom: i * s.step }}>
          <Chip d={d} size={size} top={i === n - 1} />
        </div>
      ))}
    </div>
  );
}

/** Physical chip stacks (no numbers): columns by colour, at most five chips per column. */
export function ChipPile({ counts, size = "md", className }: { counts: ChipCounts; size?: ChipSize; className?: string }) {
  const columns: { d: Denomination; n: number }[] = [];
  for (const d of DENOMINATIONS) {
    let left = counts[d] ?? 0;
    while (left > 0) {
      const n = Math.min(CHIPS_PER_STACK, left);
      columns.push({ d, n });
      left -= n;
    }
  }
  if (columns.length === 0) return null;
  return (
    <div className={cn("flex max-w-[11rem] flex-wrap items-end justify-center gap-x-0.5 gap-y-1", className)} aria-label="chips">
      {columns.map((c, i) => (
        <Column key={i} d={c.d} n={c.n} size={size} />
      ))}
    </div>
  );
}

/** Colour → value key, only for the denominations in play. */
export function ChipLegend({ denoms, className }: { denoms: readonly Denomination[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {DENOMINATIONS.filter((d) => denoms.includes(d)).map((d) => (
        <div key={d} className="flex items-center gap-1">
          <div className="relative" style={{ width: SIZES.md.w, height: SIZES.md.h }}>
            <Chip d={d} size="md" top />
          </div>
          <span className="font-mono text-xs font-bold tabular">{CHIP_STYLE[d].label}</span>
        </div>
      ))}
    </div>
  );
}
