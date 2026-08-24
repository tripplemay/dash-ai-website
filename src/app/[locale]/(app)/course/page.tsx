import { useTranslations } from "next-intl";
import type { Metadata } from "next";
import { CoordinateField } from "@/components/coordinate-field";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "课程介绍中心" };
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "@/i18n/navigation";
import { CourseGrowth } from "@/components/course-growth";
import { WorksWall } from "@/components/works-wall";
import { MonitorPlay, Wand2 } from "lucide-react";
import { COURSE_ENTRIES, FAQ } from "@/lib/data";
import { stageOnAccent } from "@/lib/brand";

/** 把 **加粗** 渲染为高亮 */
function rich(text: string) {
  return text.split("**").map((seg, i) =>
    i % 2 === 1 ? (
      <b key={i} className="text-coral-700">
        {seg}
      </b>
    ) : (
      <span key={i}>{seg}</span>
    )
  );
}

export default function CoursePage() {
  const t = useTranslations("course");

  return (
    <>
      <section className="relative overflow-hidden bg-reverse-background px-0 pt-11 pb-8.5 text-white">
        <CoordinateField className="absolute top-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-extrabold tracking-[2px]">
                {t("title1")}
                <em className="not-italic text-coral-300">{t("title2")}</em>
              </h1>
              <div className="mt-2 text-[13.5px] tracking-wide text-neutral-300">{t("sub")}</div>
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/courses/wizard"
                className="flex items-center gap-2 rounded-md border border-coral-300/60 bg-coral-500/10 px-4 py-2.5 text-[13px] font-extrabold tracking-widest text-coral-300 transition-colors hover:bg-coral-500/20"
              >
                <Wand2 className="size-4" />
                {t("wizardEntry")}
              </Link>
              <Link
                href="/presentations/course"
                className="flex items-center gap-2 rounded-md border border-coral-300/60 bg-coral-500/10 px-4 py-2.5 text-[13px] font-extrabold tracking-widest text-coral-300 transition-colors hover:bg-coral-500/20"
              >
                <MonitorPlay className="size-4" />
                {t("presentEntry")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 课程体系总览 */}
      <section id="curriculum" className="mx-auto max-w-[1200px] scroll-mt-24 px-7 py-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {t("systemTitle")} <em className="not-italic text-coral-700">{t("systemEm")}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-neutral-600">{t("systemSub")}</div>
        <div className="mt-5 grid gap-3">
          {COURSE_ENTRIES.map(({ course }) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}`}
              id={course.stageId === "01" ? "create" : course.stageId === "04" ? "build" : course.stageId === "08" ? "explore" : undefined}
              className="relative block rounded-lg border border-neutral-200 bg-card p-[16px_18px] transition-shadow hover:border-indigo-300 hover:shadow-card"
            >
              <div className="absolute top-3.5 bottom-3.5 left-0 w-1 rounded-sm" style={{ background: course.color }} />
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md text-[11px] font-extrabold" style={{ background: course.color, color: stageOnAccent(course.color) }}>
                  {course.stageId}
                </span>
                <span className="text-[17px] font-extrabold">{course.name}</span>
                <Badge variant="secondary" className="bg-indigo-50 text-[11px] font-bold text-neutral-600">
                  {course.age}
                </Badge>
                <span className="ml-auto rounded-md bg-indigo-700 px-3 py-1 text-[12.5px] font-extrabold text-white">
                  {course.count}
                </span>
              </div>
              <div className="mt-2.5 text-[12.5px] leading-[1.8] text-neutral-600">{course.intro}</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {course.modules.map((module) => (
                  <span key={module} className="rounded-sm border border-indigo-100 bg-indigo-50 px-2.5 py-[3px] text-[11px] text-indigo-800">
                    {module}
                  </span>
                ))}
              </div>
              <div className="mt-2.5 text-[12.5px] font-extrabold text-coral-700">
                {t("outcome")}
                <b className="text-indigo-800">{course.outputs.join(" · ")}</b>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 课程框架 · 能力轴与学习闭环 */}
      <CourseGrowth />

      {/* 学员作品墙（占位） */}
      <WorksWall />

      {/* 家长 FAQ */}
      <section className="mx-auto max-w-[1200px] px-7 py-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {t("faqTitle")} <em className="not-italic text-coral-700">{t("faqEm")}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-neutral-600">{t("faqSub")}</div>
        <Accordion className="mt-3.5">
          {FAQ.map(([q, a], i) => (
            <AccordionItem
              key={i}
              value={`q-${i}`}
              className="mb-2.5 overflow-hidden rounded-lg border border-neutral-200 bg-card px-0"
            >
              <AccordionTrigger className="px-4.5 py-3.5 text-[15px] font-extrabold text-indigo-800 hover:no-underline">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-indigo-700 text-xs text-white">
                    Q
                  </span>
                  {q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4.5 pb-4 pl-[52px] text-[13px] leading-[1.85] text-neutral-600">
                {rich(a)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
