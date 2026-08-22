import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Award } from "lucide-react";
import { Spotlight } from "@/components/aceternity/spotlight";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { CourseExplorer } from "@/components/course-explorer";
import { COURSE_ENTRIES, GROWTH_BADGES } from "@/lib/data";
import { COURSE_SLUGS } from "@/lib/lessons";
import { LESSON_DETAILS } from "@/lib/lesson-content";

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const entry = findEntry(slug);
  if (!entry) notFound();

  const t = await getTranslations("course");
  const { lab, course } = entry;
  const lessons = LESSON_DETAILS[course.slug];
  const badge = GROWTH_BADGES.find((b) => b.lab === course.name);
  const siblings = lab.courses
    .filter((c) => c.slug !== course.slug)
    .map((c) => ({ slug: c.slug, name: c.name }));
  // ?lesson=N：1..N 直达某节课；0 / 缺省 / 非法值 = 课程总览
  const raw = Number(sp.lesson);
  const initial = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), lessons.length) : 0;

  return (
    <>
      {/* 页头：主题实验室 + 课程名 + 适龄/课时/认证徽章 */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#9FB3E8]">
            <Link href="/courses" className="transition-colors hover:text-cyan">{t("breadcrumbCourses")}</Link>
            <span aria-hidden="true">/</span>
            <span>{lab.name}</span>
            <span aria-hidden="true">/</span>
            <span className="text-white">{course.name}</span>
          </nav>
          <Link
            href="/courses"
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

      {/* 左栏课表 + 右侧详情（客户端交互，URL 同步 ?lesson=N） */}
      <CourseExplorer
        lab={{ name: lab.name, color: lab.color }}
        course={course}
        lessons={lessons}
        siblings={siblings}
        initial={initial}
      />
    </>
  );
}
