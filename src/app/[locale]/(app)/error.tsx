"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("App route failed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[55vh] max-w-[720px] flex-col items-center justify-center px-7 py-16 text-center">
      <div className="rounded-2xl border border-[#E4EAF7] bg-card px-7 py-10 shadow-card">
        <h1 className="text-xl font-extrabold text-navy">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-subtext">{t("description")}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-navy px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#24348A] focus-visible:ring-2 focus-visible:ring-cyan"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
