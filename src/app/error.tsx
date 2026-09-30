"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

/** Last-resort screen for rendering errors; keeps the user's data and offers a way out. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">{t.errorTitle}</h1>
      <p className="text-sm text-muted">{t.errorBody}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => (reset(), window.location.reload())}>
          {t.reload}
        </Button>
        <Link href="/stats/">
          <Button variant="secondary">{t.backupTitle}</Button>
        </Link>
      </div>
    </main>
  );
}
