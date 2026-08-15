import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Award } from "lucide-react";
import { Spotlight } from "@/components/aceternity/spotlight";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { COURSE_ENTRIES, GROWTH_BADGES } from "@/lib/data";
import { COURSE_SLUGS, LESSONS } from "@/lib/lessons";

export function generateStaticParams() {
  return COURSE_SLUGS.map((slug) => ({ slug }));
}

function findEntry(slug: string) {
  return COURSE_ENTRIES.find((e) => e.course.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = findEntry(slug);
  return { title: entry ? entry.course.name : "课程介绍中心" };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) notFound();

  const t = await getTranslations("course");
  const { lab, course } = entry;
  const lessons = LESSONS[course.slug];
  const badge = GROWTH_BADGES.find((b) => b.lab === course.name);
  const siblings = lab.courses.filter((c) => c.slug !== course.slug);
  const compact = lessons.length > 16; // 课时多的课程分栏紧凑展示

  return (
    <>
      {/* 页头：主题实验室 + 课程名 + 适龄/课时/认证徽章 */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <Link
            href="/course"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-wider text-[#9FB3E8] transition-colors hover:text-cyan"
          >
            <ArrowLeft className="size-3.5" />
            {t("detailBack")}
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className="rounded-[10px] px-3.5 py-1.5 text-xs font-extrabold tracking-widest text-white"
              style={{ background: lab.color }}
            >
              {lab.en}
            </span>
            <span className="text-[15px] font-extrabold tracking-wide text-[#BFEFFF]">{lab.name}</span>
          </div>
          <h1 className="mt-3 text-[34px] font-extrabold tracking-[2px]">{course.name}</h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <Badge variant="secondary" className="bg-white/12 text-[12px] font-bold text-white">
              {course.age}
            </Badge>
            <span className="rounded-[9px] bg-white/12 px-3 py-1 text-[12.5px] font-extrabold text-white">
              {course.count}
            </span>
            {badge && (
              <span
                className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[12.5px] font-extrabold text-white"
                style={{ background: badge.color }}
              >
                <Award className="size-3.5" />
                {t("detailBadge", { elem: badge.elem })}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-7 py-8.5">
        {/* 课程简介：intro + 现实锚点 */}
        <section>
          <h2 className="text-[22px] font-extrabold tracking-[2px]">
            {t("detailIntro")}
          </h2>
          <div className="mt-3 rounded-[14px] border border-[#E4EAF7] bg-card p-[18px_20px] text-[13.5px] leading-[1.9] text-subtext">
            <p>{course.intro}</p>
            <p className="mt-2">{course.reality}</p>
          </div>
        </section>

        {/* 课程内容模块 */}
        <section className="mt-8.5">
          <h2 className="text-[22px] font-extrabold tracking-[2px]">{t("detailModules")}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {course.modules.map((m) => (
              <span
                key={m}
                className="rounded-lg border border-[#E0EAF8] bg-[#F0F5FC] px-2.5 py-[3px] text-[11.5px] text-[#3D5A80]"
              >
                {m}
              </span>
            ))}
          </div>
        </section>

        {/* 逐课大纲 */}
        <section className="mt-8.5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[22px] font-extrabold tracking-[2px]">{t("detailLessons")}</h2>
            <span className="text-[12.5px] font-bold text-subtext">
              {t("detailLessonsCount", { count: lessons.length })}
            </span>
          </div>
          <div
            className={`mt-3 grid gap-2.5 sm:grid-cols-2 ${compact ? "lg:grid-cols-3" : ""}`}
          >
            {lessons.map((l) => (
              <div
                key={l.n}
                className={`flex items-center gap-2.5 rounded-[12px] border border-[#E4EAF7] bg-card ${
                  compact ? "px-3 py-2" : "px-3.5 py-2.5"
                }`}
              >
                <span
                  className="flex size-6.5 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-extrabold text-white"
                  style={{ background: lab.color }}
                >
                  {l.n}
                </span>
                <span className="text-[12.5px] font-bold text-navy">{l.title}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 结课产出 */}
        <section className="mt-8.5">
          <div className="rounded-[14px] bg-[linear-gradient(135deg,#101C52,#1B2A6B)] p-[18px_20px] text-white">
            <div className="text-[12px] font-extrabold tracking-[3px] text-cyan">{t("detailOutcome")}</div>
            <div className="mt-2 text-[17px] font-extrabold tracking-wide">{course.outcome}</div>
          </div>
        </section>

        {/* 页脚导航：返回 + 同主题课程 */}
        <section className="mt-8.5 flex flex-wrap items-center gap-2.5 border-t-2 border-[#E4EAF7] pt-6">
          <Link
            href="/course"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#D6E2F8] bg-card px-4 py-2.5 text-[12.5px] font-extrabold text-navy transition-colors hover:border-cyan-print hover:text-cyan-print"
          >
            <ArrowLeft className="size-3.5" />
            {t("detailBack")}
          </Link>
          {siblings.length > 0 && (
            <>
              <span className="ml-2 text-[12px] font-bold text-subtext">{t("detailSibling")}</span>
              {siblings.map((c) => (
                <Link
                  key={c.slug}
                  href={`/course/${c.slug}`}
                  className="rounded-[10px] px-4 py-2.5 text-[12.5px] font-extrabold text-white transition-opacity hover:opacity-85"
                  style={{ background: lab.color }}
                >
                  {c.name}
                </Link>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}
