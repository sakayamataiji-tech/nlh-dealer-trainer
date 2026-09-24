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

interface Row {
  who: string;
  text: string;
  type: TableAction["type"];
}

/** Collapse a run of antes posted by every player into one row ("ALL  ANTE 25 × 6"). */
function rowsFor(actions: TableAction[], nameOf: (id: string) => string): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (a.type === "ante") {
      let j = i;
      while (j + 1 < actions.length && actions[j + 1].type === "ante" && actions[j + 1].amount === a.amount) j++;
      const count = j - i + 1;
      if (count > 1) {
        rows.push({ who: "ALL", text: `ANTE ${formatChips(a.amount ?? 0)} × ${count}`, type: "ante" });
        i = j;
        continue;
      }
    }
    rows.push({ who: nameOf(a.playerId), text: actionText(a), type: a.type });
  }
  return rows;
}

/** Street-grouped action list. Raise/bet/all-in amounts are "to" (street total). */
export function ActionLog({ actions, nameOf, dense = false, columns = false }: { actions: TableAction[]; nameOf: (id: string) => string; dense?: boolean; columns?: boolean }) {
  const streets = STREETS.filter((s) => actions.some((a) => a.street === s));
  return (
    <div className={cn(columns ? "grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4" : "flex flex-col", dense ? "gap-1.5" : "gap-2")}>
      {streets.map((s: Street) => (
        <div key={s}>
          <div className="mb-0.5 text-[10px] font-bold tracking-[0.25em] text-brass-dim">{s.toUpperCase()}</div>
          <ol className={cn("grid gap-x-3 font-mono tabular", dense ? "text-[13px]" : "text-sm", "grid-cols-[3.4rem_1fr]")}>
            {rowsFor(
              actions.filter((a) => a.street === s),
              nameOf,
            ).map((row, i) => (
              <li key={i} className="contents">
                <span className="text-muted">{row.who}</span>
                <span className={cn("font-semibold", TYPE_STYLE[row.type])}>{row.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
