import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AppPageHero } from "@/components/app-page-hero";
import { PapersBrowser } from "@/components/papers-browser";
import { listPaperCompetitions, PAPERS_GENERATED_AT } from "@/lib/papers";
import { getQuestionCounts } from "@/lib/paper-questions";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "competitionPapers");
}

export default async function CompetitionPapersPage() {
  const t = await getTranslations("competitions");
  const entries = listPaperCompetitions();
  const questionCounts = Object.fromEntries(getQuestionCounts());
  const totalMaterials = entries.reduce((sum, entry) => sum + entry.papers.length, 0);

  return (
    <>
      <AppPageHero className="pt-6 pb-5 sm:pt-9 sm:pb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("papersEyebrow")}</div>
            <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px]">{t("papersTitle")}</h1>
            <div className="mt-2 max-w-[720px] text-[13.5px] leading-6 tracking-wide text-neutral-300">{t("papersSubtitle")}</div>
            <div className="mt-3 font-mono text-[12px] font-bold text-neutral-400">
              {t("papersStats", { competitions: entries.length, count: totalMaterials })} · {t("papersUpdatedAt", { date: PAPERS_GENERATED_AT.slice(0, 10) })}
            </div>
          </div>
        </div>
      </AppPageHero>

      {entries.length === 0 ? (
        <section className="w-full px-5 py-10 sm:px-7">
          <div className="rounded-xl border border-dashed border-neutral-300 bg-card p-10 text-center">
            <p className="text-sm leading-7 text-neutral-600">{t("papersEmpty")}</p>
          </div>
        </section>
      ) : (
        <Suspense fallback={<p className="p-7 text-sm text-neutral-600">{t("loading")}</p>}>
          <PapersBrowser entries={entries} questionCounts={questionCounts} />
        </Suspense>
      )}

      <aside className="mx-5 mb-10 rounded-lg border border-amber-100 bg-amber-50 p-4 text-[12.5px] leading-6 text-amber-900 sm:mx-7">
        <h2 className="font-extrabold">{t("papersCopyrightTitle")}</h2>
        <p>{t("papersCopyright")}</p>
      </aside>
    </>
  );
}
