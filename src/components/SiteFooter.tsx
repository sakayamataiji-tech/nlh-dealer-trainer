"use client";
import Link from "next/link";
import { SITE } from "@/config/site";
import { useI18n } from "@/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-muted">
      <nav className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/privacy/" className="hover:text-text">
          {t.privacy}
        </Link>
        <Link href="/terms/" className="hover:text-text">
          {t.terms}
        </Link>
        <Link href="/stats/" className="hover:text-text">
          {t.backupLink}
        </Link>
      </nav>
      <span className="tabular">
        © {new Date().getFullYear()} {SITE.name} · v{SITE.version}
      </span>
    </footer>
  );
}
