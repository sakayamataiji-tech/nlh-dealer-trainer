import type { ReactNode } from "react";

/** iPad-landscape first: table left, question/answer panel right. Stacks on narrow screens. */
export function ModeLayout({ table, panel }: { table: ReactNode; panel: ReactNode }) {
  return (
    <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 items-center justify-center">{table}</div>
      <div className="flex min-w-0 flex-col gap-3">{panel}</div>
    </div>
  );
}

export function Question({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-lg font-bold tracking-wide sm:text-xl">{children}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
