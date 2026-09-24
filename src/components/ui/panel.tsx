import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-panel", className)} {...props} />;
}

export function Label({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-muted", className)} {...props} />;
}

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("hidden rounded border border-line bg-ink px-1.5 py-0.5 font-mono text-[10px] text-muted md:inline-block", className)} {...props} />;
}
