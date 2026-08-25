import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { CourseExplorer } from "@/components/course-explorer";
import { COURSE_ENTRIES } from "@/lib/data";
import { COURSE_SLUGS } from "@/lib/lessons";
import { LESSON_DETAILS } from "@/lib/lesson-content";
import { stageOnAccent } from "@/lib/brand";

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
  const siblings = lab.courses
    .filter((c) => c.slug !== course.slug)
    .map((c) => ({ slug: c.slug, name: c.name }));
  // ?lesson=N：1..N 直达某节课；0 / 缺省 / 非法值 = 课程总览
  const raw = Number(sp.lesson);
  const initial = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), lessons.length) : 0;

  return (
    <>
      {/* 页头：课程域 + 课程名 + 进阶方式/课次 */}
      <AppPageHero>
        <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-neutral-300">
          <Link href="/courses" className="transition-colors hover:text-coral-300">{t("breadcrumbCourses")}</Link>
          <span aria-hidden="true">/</span>
          <span>课程域 {course.stageId}</span>
          <span aria-hidden="true">/</span>
          <span className="text-white">{course.name}</span>
        </nav>
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-wider text-neutral-300 transition-colors hover:text-coral-300"
        >
          <ArrowLeft className="size-3.5" />
          {t("detailBack")}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="rounded-md px-3.5 py-1.5 text-xs font-extrabold tracking-widest"
            style={{ background: course.color, color: stageOnAccent(course.color) }}
          >
            {`COURSE DOMAIN ${course.stageId}`}
          </span>
        </div>
        <h1 className="mt-3 text-[34px] font-extrabold tracking-[2px]">{course.name}</h1>
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <Badge variant="secondary" className="rounded-md border border-white/20 bg-white/10 text-[12px] font-bold text-white">
            {course.age}
          </Badge>
          <span className="rounded-md bg-white/10 px-3 py-1 text-[12.5px] font-extrabold text-white">
            {course.count}
          </span>
        </div>
      </AppPageHero>

      {/* 左栏课表 + 右侧详情（客户端交互，URL 同步 ?lesson=N） */}
      <CourseExplorer
        lab={{ name: `课程域 ${course.stageId}`, color: course.color }}
        course={course}
        lessons={lessons}
        siblings={siblings}
        initial={initial}
      />
    </>
  );
}
