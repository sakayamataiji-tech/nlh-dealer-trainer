"use client";
import { useEffect } from "react";
import { statsStore, useStats } from "@/lib/statsStore";
import { cn } from "@/lib/utils";
import { LANGS, MESSAGES, type Lang, type Messages } from "./messages";

export type { Lang, Messages };

/** Browser language on first visit: Japanese → ja, anything else → en. */
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "ja";
  return navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function useI18n(): { lang: Lang; t: Messages } {
  const stats = useStats();
  // Before hydration (and on the server) render Japanese so markup matches the static export.
  const lang: Lang = stats ? (stats.settings.lang ?? detectLang()) : "ja";
  return { lang, t: MESSAGES[lang] };
}

/** Keeps <html lang> in sync with the chosen language. */
export function HtmlLang() {
  const { lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang } = useI18n();
  return (
    <div className={cn("flex overflow-hidden rounded-lg border border-line", className)} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => statsStore.setLang(l.value)}
          className={cn("h-9 px-3 text-xs font-bold", l.value === lang ? "bg-brass/15 text-brass" : "text-muted hover:text-text")}
          aria-pressed={l.value === lang}
        >
          {l.value === "ja" ? "日本語" : "EN"}
        </button>
      ))}
    </div>
  );
}
