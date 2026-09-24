import type { TableAction, Street } from "@/engine/actions";
import { STREETS } from "@/engine/actions";
import { cn, formatChips } from "@/lib/utils";

export function actionText(a: TableAction): string {
  const amt = a.amount !== undefined ? ` ${formatChips(a.amount)}` : "";
  switch (a.type) {
    case "ante":
      return `ANTE${amt}`;
    case "post_sb":
      return `POST SB${amt}`;
    case "post_bb":
      return `POST BB${amt}`;
    case "fold":
      return "FOLD";
    case "check":
      return "CHECK";
    case "call":
      return `CALL${amt}`;
    case "bet":
      return `BET${amt}`;
    case "raise":
      return `RAISE${amt}`;
    case "allin":
      return `ALL-IN${amt}`;
  }
}

const TYPE_STYLE: Record<TableAction["type"], string> = {
  ante: "text-muted",
  post_sb: "text-muted",
  post_bb: "text-muted",
  fold: "text-muted/70",
  check: "text-text/80",
  call: "text-text",
  bet: "text-brass",
  raise: "text-brass",
  allin: "text-bad",
};

/** Street-grouped action list. Raise/bet/all-in amounts are "to" (street total). */
export function ActionLog({ actions, nameOf, dense = false, columns = false }: { actions: TableAction[]; nameOf: (id: string) => string; dense?: boolean; columns?: boolean }) {
  const streets = STREETS.filter((s) => actions.some((a) => a.street === s));
  return (
    <div className={cn(columns ? "grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4" : "flex flex-col", dense ? "gap-1.5" : "gap-2")}>
      {streets.map((s: Street) => (
        <div key={s}>
          <div className="mb-0.5 text-[10px] font-bold tracking-[0.25em] text-brass-dim">{s.toUpperCase()}</div>
          <ol className={cn("grid gap-x-3 font-mono tabular", dense ? "text-[13px]" : "text-sm", "grid-cols-[3.4rem_1fr]")}>
            {actions
              .filter((a) => a.street === s)
              .map((a, i) => (
                <li key={i} className="contents">
                  <span className="text-muted">{nameOf(a.playerId)}</span>
                  <span className={cn("font-semibold", TYPE_STYLE[a.type])}>{actionText(a)}</span>
                </li>
              ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
