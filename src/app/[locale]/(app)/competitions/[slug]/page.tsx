import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { CompetitionStatusBadge } from "@/components/competition-status-badge";
import { CompetitionSchedule } from "@/components/competition-schedule";
import { CATEGORY_BADGE_DARK, CATEGORY_LABEL_KEYS, GRADE_LABEL_KEYS } from "@/components/competition-meta";
import { COMPETITIONS, getCompetition, MOE_LIST, competitionDateKey, competitionQueryString } from "@/lib/competitions";
import { COURSE_ENTRIES, type CourseEntry } from "@/lib/data";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return COMPETITIONS.map((competition) => ({ slug: competition.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetition(slug);
  return { title: competition ? competition.nameZh : "赛事频道" };
}

export default async function CompetitionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { slug } = await params;
  const competition = getCompetition(slug);
  if (!competition) notFound();

  const t = await getTranslations("competitions");
  const locale = await getLocale();
  const initialToday = competitionDateKey();
  const { from } = await searchParams;
  const query = competitionQueryString(new URLSearchParams(typeof from === "string" ? from.slice(0, 2000) : ""));
  const backHref = `/competitions${query ? "?" + query : ""}#competition-${competition.slug}`;
  const updates = [...competition.updates].sort((a, b) => b.date.localeCompare(a.date));
  const relatedCourses = competition.relatedCourses
    .map((courseSlug) => COURSE_ENTRIES.find((entry) => entry.course.slug === courseSlug))
    .filter((entry): entry is CourseEntry => Boolean(entry));

  return (
    <>
      <AppPageHero className="pt-6 pb-6 sm:pt-9">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-wider text-neutral-300 transition-colors hover:text-coral-300"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToList")}
        </Link>
        <h1 className="mt-4 text-[26px] leading-snug font-extrabold sm:text-[34px]">{locale === "en" && competition.nameEn ? competition.nameEn : competition.nameZh}</h1>
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <Badge
            variant="secondary"
            className={cn("rounded-md border text-[12px] font-bold", CATEGORY_BADGE_DARK[competition.category])}
          >
            {t(CATEGORY_LABEL_KEYS[competition.category])}
          </Badge>
          <CompetitionStatusBadge schedule={competition.schedule} initialToday={initialToday} />
        </div>
        <div className="mt-4 text-[12.5px] text-neutral-300">
          {t("organizer")}：{competition.organizer}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-bold text-neutral-400">{t("gradesLabel")}</span>
          {competition.grades.map((grade) => (
            <span key={grade} className="rounded-md bg-white/10 px-2.5 py-1 text-[11.5px] font-bold text-white">
              {t(GRADE_LABEL_KEYS[grade])}
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-200">{competition.summary}</p>
        <p className="mt-2 text-xs leading-6 text-neutral-300">{t("sourceCheckedAt", { date: competition.sourceCheckedAt })} · {t("timeZoneNote")}</p>
        {competition.officialSite && (
          <a
            href={competition.officialSite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-coral-300/60 bg-coral-500/10 px-4 py-2.5 text-[13px] font-extrabold tracking-widest text-coral-300 transition-colors hover:bg-coral-500/20"
          >
            {t("officialEntry")}
            <ExternalLink className="size-4" />
          </a>
        )}
      </AppPageHero>

      <nav aria-label={t("detailNavigation")} className="flex flex-wrap gap-2 border-b border-neutral-200 px-5 py-3 sm:px-7">
        {["intro", "schedule", "updates"].map((id) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-indigo-800 hover:bg-indigo-50">
            {t(id === "intro" ? "introTitle" : id === "schedule" ? "scheduleTitle" : "updatesTitle")}
          </a>
        ))}
      </nav>
      <aside className="mx-5 mt-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm leading-7 text-indigo-900 sm:mx-7">
        <h2 className="font-extrabold">{t("beforeJoining")}</h2>
        <p>{t("eligibilityNote")}</p>
        {locale === "en" && <p className="mt-1">{t("originalLanguageNote")}</p>}
      </aside>
      <section id="intro" className="w-full scroll-mt-24 px-5 pt-8 sm:px-7">
        <h2 className="text-[26px] font-extrabold text-indigo-900">{t("introTitle")}</h2>
        <p className="mt-3 max-w-[820px] text-[14px] leading-[1.9] font-bold text-neutral-800">{competition.summary}</p>
        <p className="mt-2.5 max-w-[820px] text-[13.5px] leading-[1.9] whitespace-pre-line text-neutral-600">
          {competition.description}
        </p>
      </section>

      <section id="schedule" className="w-full scroll-mt-24 px-5 pt-10 sm:px-7">
        <h2 className="text-[26px] font-extrabold text-indigo-900">{t("scheduleTitle")}</h2>
        {competition.schedule.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-card p-6 text-[13px] text-neutral-500">
            {t("scheduleEmpty")}
          </div>
        ) : (
          <CompetitionSchedule schedule={competition.schedule} initialToday={initialToday} />
        )}
      </section>

      <section id="updates" className="w-full scroll-mt-24 px-5 pt-10 sm:px-7">
        <h2 className="text-[26px] font-extrabold text-indigo-900">{t("updatesTitle")}</h2>
        {updates.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-card p-6 text-[13px] text-neutral-500">
            {t("updatesEmpty")}
          </div>
        ) : (
          <ol className="mt-5 space-y-3">
            {updates.map((update) => (
              <li
                key={`${update.date}-${update.title}`}
                className="rounded-lg border border-neutral-200 bg-card p-[14px_16px]"
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <time className="font-mono text-[11px] font-bold text-neutral-400">{update.date}</time>
                  {update.url ? (
                    <a
                      href={update.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[14px] font-extrabold text-indigo-800 transition-colors hover:text-coral-700"
                    >
                      {update.title}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-[14px] font-extrabold text-indigo-800">{update.title}</span>
                  )}
                </div>
                {update.summary && (
                  <p className="mt-1.5 text-[12.5px] leading-[1.8] text-neutral-600">{update.summary}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {competition.links.length > 0 && (
        <section className="w-full px-5 pt-10 sm:px-7">
          <h2 className="text-[26px] font-extrabold text-indigo-900">{t("linksTitle")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {competition.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-[12.5px] font-bold text-indigo-800 transition-colors hover:border-indigo-400"
              >
                {link.label}
                <ExternalLink className="size-3.5" />
              </a>
            ))}
          </div>
        </section>
      )}

      {relatedCourses.length > 0 && (
        <section className="w-full px-5 pt-10 sm:px-7">
          <h2 className="text-[26px] font-extrabold text-indigo-900">{t("relatedCourses")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedCourses.map(({ course }) => (
              <Link
                key={course.slug}
                href={`/courses/${course.slug}`}
                className="relative block rounded-lg border border-neutral-200 bg-card p-[14px_16px] transition-shadow hover:border-indigo-300 hover:shadow-card"
              >
                <div className="absolute top-3 bottom-3 left-0 w-1 rounded-sm" style={{ background: course.color }} />
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-extrabold text-indigo-900">{course.name}</span>
                  <span className="ml-auto text-[11px] font-bold text-neutral-400">{course.count}</span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-[12px] leading-[1.7] text-neutral-600">{course.intro}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="w-full px-5 pt-10 pb-10 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-neutral-200 pt-4 text-[11.5px] text-neutral-400">
          <span>{t("sourceCheckedAt", { date: competition.sourceCheckedAt })}</span>
          <a
            href={MOE_LIST.announcementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-indigo-700 transition-colors hover:text-coral-700"
          >
            {t("moeSource")}
            <ExternalLink className="size-3" />
          </a>
        </div>
      </footer>
    </>
  );
}
