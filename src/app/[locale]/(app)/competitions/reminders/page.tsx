import { getTranslations } from "next-intl/server";
import { AppPageHero } from "@/components/app-page-hero";
import { CompetitionReminders } from "@/components/competition-reminders";
import { COMPETITIONS } from "@/lib/competitions";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "competitions" });
  return { title: t("myReminders") };
}
export default async function CompetitionRemindersPage() {
  const t = await getTranslations("competitions");
  return <>
    <AppPageHero className="pt-6 pb-6 sm:pt-9">
      <Link href="/competitions" className="inline-flex min-h-11 items-center text-sm font-bold text-neutral-200 hover:text-coral-300">{t("backToList")}</Link>
      <h1 className="mt-3 text-[28px] font-extrabold sm:text-[32px]">{t("myReminders")}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">{t("remindersSubtitle")}</p>
      <Link href="/competitions/calendar?following=1" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-white/30 px-3 text-sm font-bold text-white">{t("followedCalendar")}</Link>
    </AppPageHero>
    <CompetitionReminders names={COMPETITIONS.map(({ slug, nameZh, nameEn }) => ({ slug, nameZh, nameEn }))} />
  </>;
}
