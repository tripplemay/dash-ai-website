import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FolderOpen,
  Layers3,
  MonitorPlay,
  PlayCircle,
  Settings2,
  Wand2,
} from "lucide-react";
import { CoordinateField } from "@/components/coordinate-field";
import { WorkspaceActivity } from "@/components/workspace-activity";
import { getWorkspaceSnapshot } from "@/lib/db";
import { getRequestSession } from "@/lib/request-session";
import { COURSE_ENTRIES, LABS } from "@/lib/data";
import { stageOnAccent } from "@/lib/brand";
import {
  formatWorkspaceDate,
  localizeCourseTitle,
  localizedResourceTitle,
  localizeResourceCategory,
  type WorkspaceLocale,
  WORKSPACE_LABS,
} from "@/lib/workspace-copy";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  {
    key: "resources",
    href: "/resources",
    icon: FolderOpen,
    tone: "bg-orange-50 text-orange-700",
    accent: "#F16C3E",
  },
  {
    key: "courses",
    href: "/courses",
    icon: BookOpen,
    tone: "bg-indigo-50 text-indigo-700",
    accent: "#40549C",
  },
  {
    key: "presentations",
    href: "/presentations/course",
    icon: MonitorPlay,
    tone: "bg-coral-50 text-coral-700",
    accent: "#FC7358",
  },
  {
    key: "brand",
    href: "/help/brand",
    icon: Settings2,
    tone: "bg-teal-50 text-teal-700",
    accent: "#1E9A91",
  },
] as const;

const ROLE_KEYS = new Set(["admin", "partner", "teacher", "guest"]);

function workspaceLocale(value: string): WorkspaceLocale {
  return value === "en" ? "en" : "zh";
}

function courseHref(slug: string, lesson: number) {
  return lesson > 0 ? `/courses/${slug}?lesson=${lesson}` : `/courses/${slug}`;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = workspaceLocale(rawLocale);
  const t = await getTranslations({ locale: rawLocale, namespace: "workspace" });
  const session = await getRequestSession();
  const snapshot = getWorkspaceSnapshot(session?.user.id ?? null);
  const role = String((session?.user as { role?: string } | undefined)?.role || "default");
  const roleKey = ROLE_KEYS.has(role) ? role : "default";

  const courseEntries = new Map(COURSE_ENTRIES.map((entry) => [String(entry.course.slug), entry]));
  const continueItems = snapshot.recentCourses.flatMap((activity) => {
    const entry = courseEntries.get(activity.courseSlug);
    if (!entry) return [];
    const courseName = localizeCourseTitle(activity.courseSlug, entry.course.name, locale);
    const labName = locale === "en" ? entry.lab.en : entry.lab.name;
    const position =
      activity.lastLesson > 0
        ? t("continue.lesson", { n: activity.lastLesson })
        : t("continue.overview");
    return [
      {
        id: activity.courseSlug,
        title: courseName,
        meta: `${labName} · ${position} · ${formatWorkspaceDate(activity.lastViewedAt, locale)}`,
        href: courseHref(activity.courseSlug, activity.lastLesson),
      },
    ];
  });

  const recentResourceItems = snapshot.recentResources.map((resource) => ({
    id: String(resource.id),
    title: localizedResourceTitle(resource, locale),
    meta: [
      locale === "en" && resource.categoryEn
        ? resource.categoryEn
        : localizeResourceCategory(resource.category, locale),
      resource.format,
      formatWorkspaceDate(resource.updatedAt, locale),
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/resources/${resource.id}`,
  }));

  const labCourseCounts = new Map(LABS.map((lab) => [lab.en, lab.courses.length]));
  const lastUpdated = snapshot.recentResources[0]?.updatedAt;
  const catalogStatus =
    snapshot.resourceStatus === "ready" ? t("release.catalogReady") : t("release.catalogUnavailable");

  return (
    <div className="min-w-0">
      <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-7 lg:py-10">
        <header aria-labelledby="workspace-title" className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[760px]">
            <p className="font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-700">{t("eyebrow")}</p>
            <h1 id="workspace-title" className="mt-2 text-[32px] font-extrabold tracking-tight text-indigo-900 sm:text-[40px]">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-[640px] text-[14px] leading-6 text-muted-foreground sm:text-[15px]">{t("subtitle")}</p>
            <p className="mt-2 text-[12px] font-bold text-muted-foreground">
              {t("roleHint", { role: t(`roles.${roleKey}`) })}
            </p>
          </div>
          <Link
            href="/courses/wizard"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-indigo-700 px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-indigo-800"
          >
            <Wand2 aria-hidden="true" className="size-4" />
            {t("headerAction")}
          </Link>
        </header>

        <section aria-label={t("release.ariaLabel")} className="relative mt-7 overflow-hidden rounded-lg bg-reverse-background px-5 py-4.5 text-white sm:px-6">
          <CoordinateField className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-mono text-[10px] font-extrabold tracking-[2px] text-coral-300">{t("release.label")}</div>
              <div className="mt-1 text-[18px] font-extrabold tracking-wide">{snapshot.release.label}</div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-neutral-300">
              <span>{catalogStatus}</span>
              {lastUpdated && <span>{t("release.updated", { date: formatWorkspaceDate(lastUpdated, locale) })}</span>}
            </div>
          </div>
        </section>

        <section aria-labelledby="workspace-continue-title" className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="workspace-continue-title" className="text-[21px] font-extrabold tracking-wide text-indigo-900">
                {continueItems.length > 0 ? t("continue.title") : t("continue.emptyTitle")}
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {continueItems.length > 0 ? t("continue.subtitle") : t("continue.emptySubtitle")}
              </p>
            </div>
            <PlayCircle aria-hidden="true" className="mb-1 size-5 shrink-0 text-coral-700" />
          </div>
          {continueItems.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {continueItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex min-h-[112px] min-w-0 flex-col rounded-lg border border-neutral-200 bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover"
                >
                  <span className="text-[11px] font-bold text-muted-foreground">{item.meta}</span>
                  <span className="mt-2 line-clamp-2 text-[15px] font-extrabold text-indigo-900 group-hover:text-coral-700">{item.title}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[12px] font-extrabold text-coral-700">
                    {t("continue.open")}
                    <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 px-5 py-4">
              <p className="max-w-[620px] text-[13px] leading-5 text-indigo-900">{t("continue.emptyBody")}</p>
              <Link href="/courses" className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-coral-700 hover:underline">
                {t("continue.emptyAction")}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          )}
        </section>

        <section aria-labelledby="workspace-actions-title" className="mt-10">
          <div>
            <h2 id="workspace-actions-title" className="text-[21px] font-extrabold tracking-wide text-indigo-900">{t("actionsTitle")}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("actionsSubtitle")}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map(({ key, href, icon: Icon, tone, accent }) => (
              <Link
                key={key}
                href={href}
                className="group relative flex min-h-[142px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
                <span className={`flex size-10 items-center justify-center rounded-md ${tone}`}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="mt-4 text-[16px] font-extrabold text-indigo-900">{t(`actions.${key}.title`)}</span>
                <span className="mt-1.5 max-w-[32ch] text-[12.5px] leading-5 text-muted-foreground">{t(`actions.${key}.description`)}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[12px] font-extrabold text-coral-700">
                  {t(`actions.${key}.cta`)}
                  <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] xl:items-start">
          <WorkspaceActivity
            items={recentResourceItems}
            title={t("resources.title")}
            subtitle={t("resources.subtitle")}
            emptyTitle={snapshot.resourceStatus === "ready" ? t("resources.emptyTitle") : t("resources.unavailableTitle")}
            emptySubtitle={snapshot.resourceStatus === "ready" ? t("resources.emptySubtitle") : t("resources.unavailableSubtitle")}
            openLabel={t("resources.open", { title: "{title}" })}
            showAllLabel={t("resources.showAll")}
            showLessLabel={t("resources.showLess")}
          />

          <section aria-labelledby="workspace-catalog-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="workspace-catalog-title" className="text-[21px] font-extrabold tracking-wide text-indigo-900">{t("catalog.title")}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">{t("catalog.subtitle")}</p>
              </div>
              <Layers3 aria-hidden="true" className="mb-1 size-5 shrink-0 text-indigo-500" />
            </div>
            <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card">
              <div className="border-b border-r border-neutral-100 p-4 sm:p-5">
                <dt className="text-[11.5px] font-bold text-muted-foreground">{t("catalog.resources")}</dt>
                <dd className="mt-1 text-[28px] font-extrabold leading-none text-indigo-900">{snapshot.catalog.enabledResources}</dd>
                <div className="mt-1 text-[11px] text-muted-foreground">{t("catalog.resourcesDetail")}</div>
              </div>
              <div className="border-b border-neutral-100 p-4 sm:p-5">
                <dt className="text-[11.5px] font-bold text-muted-foreground">{t("catalog.labs")}</dt>
                <dd className="mt-1 text-[28px] font-extrabold leading-none text-indigo-900">{snapshot.catalog.labCount}</dd>
                <div className="mt-1 text-[11px] text-muted-foreground">{t("catalog.labsDetail", { count: snapshot.catalog.labCount })}</div>
              </div>
              <div className="border-r border-neutral-100 p-4 sm:p-5">
                <dt className="text-[11.5px] font-bold text-muted-foreground">{t("catalog.courses")}</dt>
                <dd className="mt-1 text-[28px] font-extrabold leading-none text-indigo-900">{snapshot.catalog.totalCourseCount}</dd>
                <div className="mt-1 text-[11px] text-muted-foreground">{t("catalog.coursesDetail", { core: snapshot.catalog.coreCourseCount })}</div>
              </div>
              <div className="p-4 sm:p-5">
                <dt className="text-[11.5px] font-bold text-muted-foreground">{t("catalog.lessons")}</dt>
                <dd className="mt-1 text-[28px] font-extrabold leading-none text-indigo-900">{snapshot.catalog.totalLessonCount}</dd>
                <div className="mt-1 text-[11px] text-muted-foreground">{t("catalog.lessonsDetail", { core: snapshot.catalog.coreLessonCount })}</div>
              </div>
            </dl>
          </section>
        </div>

        <section aria-labelledby="workspace-labs-title" className="mt-11">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="workspace-labs-title" className="text-[21px] font-extrabold tracking-wide text-indigo-900">{t("labs.title")}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{t("labs.subtitle")}</p>
            </div>
            <Link href="/courses" className="inline-flex items-center gap-1 text-[12.5px] font-extrabold text-coral-700 hover:underline">
              {t("labs.viewAll")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {WORKSPACE_LABS.map((lab) => {
              const name = locale === "en" ? lab.nameEn : lab.nameZh;
              const description = locale === "en" ? lab.descriptionEn : lab.descriptionZh;
              const age = locale === "en" ? lab.ageEn : lab.ageZh;
              const courseCount = labCourseCounts.get(lab.key) ?? 0;
              return (
                <Link
                  key={lab.key}
                  href={`/courses#${lab.anchor}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div className="relative h-28 overflow-hidden bg-neutral-100 sm:h-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lab.preview} alt={name} width={640} height={360} loading="lazy" decoding="async" className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-reverse-background/45" />
                    <span className="absolute top-3 left-3 rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-[1.5px]" style={{ background: lab.color, color: stageOnAccent(lab.color) }}>
                      {lab.key}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[16px] font-extrabold text-indigo-900">{name}</h3>
                      <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-[10.5px] font-extrabold text-indigo-800">{t("labs.courseCount", { count: courseCount })}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
                      <span>{age}</span>
                      <span>{t("labs.hours", { count: lab.hours })}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="workspace-featured-title" className="mt-11 pb-3">
          <div className="relative overflow-hidden rounded-lg bg-reverse-background px-5 py-5 text-white sm:px-7 sm:py-6">
            <CoordinateField className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-10 mix-blend-screen" />
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-[620px]">
                <h2 id="workspace-featured-title" className="text-[21px] font-extrabold tracking-wide">{t("featured.title")}</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-neutral-300">{t("featured.subtitle")}</p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/resources?cat=visual-previews" className="inline-flex items-center gap-1.5 rounded-md bg-coral-500 px-3.5 py-2.5 text-[12px] font-extrabold text-neutral-950 hover:bg-coral-300">
                  {t("featured.viewPreviews")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
                <Link href="/help/brand" className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3.5 py-2.5 text-[12px] font-extrabold text-white hover:bg-white/10">
                  {t("featured.viewGuidelines")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
