"use client";
import { EXPERIENCE_OPTIONS } from "@/stats/types";
import { statsStore } from "@/lib/statsStore";
import { LanguageToggle, useI18n } from "@/i18n";

/** First launch only: dealer experience sets the initial difficulty. */
export function Onboarding() {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="animate-rise w-full max-w-md rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-[0.3em] text-brass">WELCOME</div>
          <LanguageToggle />
        </div>
        <h2 className="mt-2 text-2xl font-black">{t.onbTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.onbBody}</p>
        <div className="mt-5 grid gap-2">
          {EXPERIENCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => statsStore.setExperience(o.value)}
              className="flex h-14 items-center justify-between rounded-xl border border-line bg-panel-2 px-4 text-left font-bold hover:border-brass"
            >
              <span className="text-lg">{t.experience[o.value]}</span>
              <span className="text-xs font-semibold tracking-widest text-muted">START LV {o.level}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
