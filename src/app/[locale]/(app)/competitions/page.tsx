import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { Link } from "@/i18n/navigation";
import { CompetitionsBrowser, type CompetitionListItem } from "@/components/competitions-browser";
import { COMPETITIONS, latestUpdate } from "@/lib/competitions";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "competitions");
}

export default async function CompetitionsPage() {
  const t = await getTranslations("competitions");

  const items: CompetitionListItem[] = COMPETITIONS.map((competition) => ({
    slug: competition.slug,
    nameZh: competition.nameZh,
    category: competition.category,
    organizer: competition.organizer,
    grades: competition.grades,
    summary: competition.summary,
    tags: competition.tags,
    schedule: competition.schedule,
    latest: latestUpdate(competition),
  }));

  return (
    <>
      <AppPageHero>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("eyebrow")}</div>
            <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px]">{t("title")}</h1>
            <div className="mt-2 max-w-[720px] text-[13.5px] leading-6 tracking-wide text-neutral-300">{t("subtitle")}</div>
          </div>
          <Link
            href="/competitions/calendar"
            className="flex items-center gap-2 rounded-md border border-coral-300/60 bg-coral-500/10 px-4 py-2.5 text-[13px] font-extrabold tracking-widest text-coral-300 transition-colors hover:bg-coral-500/20"
          >
            <CalendarDays className="size-4" />
            {t("calendarEntry")}
          </Link>
        </div>
      </AppPageHero>

      <CompetitionsBrowser items={items} />
    </>
  );
}
