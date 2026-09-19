import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { CompetitionCalendar } from "@/components/competition-calendar";
import { Link } from "@/i18n/navigation";
import { COMPETITIONS, competitionDateKey } from "@/lib/competitions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "competitions" });
  return { title: t("calendarTitle") };
}

export default async function CompetitionCalendarPage() {
  const t = await getTranslations("competitions");
  const items = COMPETITIONS.map(({ slug, nameZh, nameEn, schedule }) => ({
    slug, nameZh, nameEn, schedule: schedule.map(({ stage, start, end }) => ({ stage, start, end })),
  }));
  return (
    <>
      <AppPageHero className="pt-6 pb-6 sm:pt-9">
        <Link href="/competitions" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-neutral-200 hover:text-coral-300">
          <ArrowLeft aria-hidden="true" className="size-4" />{t("listEntry")}
        </Link>
        <h1 className="mt-3 text-[28px] font-extrabold sm:text-[32px]">{t("calendarTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">{t("calendarSubtitle")}</p>
      </AppPageHero>
      <Suspense fallback={<p className="p-7 text-sm text-neutral-600">{t("loading")}</p>}>
        <CompetitionCalendar items={items} initialToday={competitionDateKey()} />
      </Suspense>
    </>
  );
}
