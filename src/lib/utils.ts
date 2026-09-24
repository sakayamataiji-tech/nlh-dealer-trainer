import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatChips(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatSeconds(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits);
}

export function formatPercent(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}
