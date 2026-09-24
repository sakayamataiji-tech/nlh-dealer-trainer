"use client";
import { Delete, CornerDownLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn, formatChips } from "@/lib/utils";

/**
 * Numeric answer input with an on-screen keypad (iPad / phone) and full keyboard support.
 * Digits are typed into the field — they are never used as choice shortcuts here.
 */
export function NumberInput({
  value,
  onChange,
  onSubmit,
  disabled,
  label,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  label: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // On touch devices use the on-screen keypad only, so the OS keyboard never covers the table.
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  useEffect(() => {
    if (autoFocus && !disabled && window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, [autoFocus, disabled, label]);

  const append = (s: string) => {
    const next = (value + s).replace(/^0+(?=\d)/, "").slice(0, 10);
    onChange(next);
  };
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "000"];
  const pretty = value ? formatChips(Number(value)) : "";

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="sr-only text-xs font-semibold tracking-[0.15em] text-muted sm:not-sr-only">{label}</span>
        <input
          ref={ref}
          inputMode={touch ? "none" : "numeric"}
          readOnly={touch}
          data-answer-input
          autoComplete="off"
          disabled={disabled}
          value={pretty}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              if (value) onSubmit();
            }
          }}
          placeholder="0"
          className="h-14 w-full rounded-lg border border-line bg-ink px-4 text-right text-3xl font-semibold tabular text-text outline-none placeholder:text-line focus:border-brass disabled:opacity-60"
        />
      </label>
      <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => append(k)}
            className="h-11 rounded-md border border-line bg-panel-2 text-lg font-semibold tabular active:bg-line disabled:opacity-40 lg:h-11"
          >
            {k}
          </button>
        ))}
        <button type="button" tabIndex={-1} disabled={disabled} onClick={() => onChange("")} className="h-11 rounded-md border border-line bg-panel-2 text-xs font-bold tracking-widest text-muted lg:h-11">
          CLEAR
        </button>
        <button type="button" tabIndex={-1} disabled={disabled} onClick={() => onChange(value.slice(0, -1))} className="flex h-11 items-center justify-center rounded-md border border-line bg-panel-2 text-muted lg:h-11" aria-label="Backspace">
          <Delete className="h-5 w-5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || !value}
          onClick={onSubmit}
          className={cn("flex h-11 items-center justify-center gap-1 rounded-md bg-brass text-sm font-bold text-ink disabled:opacity-40 lg:h-11")}
        >
          <CornerDownLeft className="h-4 w-4" /> ENTER
        </button>
      </div>
    </div>
  );
}
