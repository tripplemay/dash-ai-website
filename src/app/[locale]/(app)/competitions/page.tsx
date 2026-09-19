import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AppPageHero } from "@/components/app-page-hero";
import { CompetitionsBrowser } from "@/components/competitions-browser";
import { COMPETITIONS, latestUpdate, competitionDateKey, type CompetitionListItem } from "@/lib/competitions";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "competitions");
}

export default async function CompetitionsPage() {
  const t = await getTranslations("competitions");

  const items: CompetitionListItem[] = COMPETITIONS.map((competition) => ({
    slug: competition.slug,
    nameZh: competition.nameZh,
    nameEn: competition.nameEn,
    moeListIndex: competition.moeListIndex,
    category: competition.category,
    organizer: competition.organizer,
    grades: competition.grades,
    summary: competition.summary,
    tags: competition.tags,
    schedule: competition.schedule.map(({ stage, start, end, completed }) => ({ stage, start, end, completed })),
    latest: latestUpdate(competition),
  }));

  return (
    <>
      <AppPageHero className="pt-6 pb-5 sm:pt-9 sm:pb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("eyebrow")}</div>
            <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px]">{t("title")}</h1>
            <div className="mt-2 max-w-[720px] text-[13.5px] leading-6 tracking-wide text-neutral-300">{t("subtitle")}</div>
          </div>
        </div>
      </AppPageHero>

      <Suspense fallback={<p className="p-7 text-sm text-neutral-600">{t("loading")}</p>}>
        <CompetitionsBrowser items={items} initialToday={competitionDateKey()} />
      </Suspense>
    </>
  );
}
