"use client";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl font-black tabular text-brass">404</div>
      <h1 className="text-xl font-bold">{t.notFoundTitle}</h1>
      <p className="text-sm text-muted">{t.notFoundBody}</p>
      <Link href="/">
        <Button variant="primary">{t.backHome}</Button>
      </Link>
    </main>
  );
}
