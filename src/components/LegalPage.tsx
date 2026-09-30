"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LanguageToggle, useI18n } from "@/i18n";
import { SITE } from "@/config/site";
import type { LegalDoc } from "@/content/legal";
import type { Lang } from "@/i18n/messages";

/** Renders a legal document in the chosen language. */
export function LegalPage({ doc }: { doc: (lang: Lang) => LegalDoc }) {
  const { lang, t } = useI18n();
  const d = doc(lang);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 pb-12 pt-3 sm:px-6">
      <header className="flex h-12 items-center gap-2 border-b border-line">
        <Link href="/" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:text-text" aria-label="Home">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 text-sm font-black tracking-[0.18em]">{SITE.name.toUpperCase()}</div>
        <LanguageToggle />
      </header>
      <h1 className="text-2xl font-black">{d.title}</h1>
      <p className="text-sm leading-relaxed text-text/85">{d.intro}</p>
      {d.sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-brass">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-text/85">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="text-xs text-muted">{t.effectiveDate(SITE.legalDate)}</p>
    </main>
  );
}
