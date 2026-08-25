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
import { ArrowRight, Eye, MonitorPlay, Wand2 } from "lucide-react";
import { COURSE_ENTRIES } from "@/lib/data";
import { stageOnAccent } from "@/lib/brand";
import { PARENT_FAQ } from "@/lib/parent-faq";

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
      <section className="mx-auto max-w-[960px] px-7 py-10 sm:py-12">
        <h2 className="text-[26px] font-extrabold">{t("faqTitle")}</h2>
        <div className="mt-1.5 text-[13.5px] leading-6 text-neutral-600">{t("faqSub")}</div>
        <Accordion className="mt-7 gap-8">
          {PARENT_FAQ.groups.map((group, groupIndex) => (
            <section key={group.id} aria-labelledby={`faq-group-${group.id}`}>
              <div className="flex items-center gap-3 border-b border-neutral-200 pb-2.5">
                <span className="text-[11px] font-extrabold text-coral-700">
                  {String(groupIndex + 1).padStart(2, "0")}
                </span>
                <h3 id={`faq-group-${group.id}`} className="text-[18px] font-extrabold text-indigo-900">
                  {group.title}
                </h3>
              </div>
              <div className="mt-3 space-y-2.5">
                {group.items.map((item) => (
                  <AccordionItem
                    key={item.slug}
                    value={item.slug}
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-card px-0"
                  >
                    <AccordionTrigger className="min-w-0 gap-3 px-4 py-3.5 text-[15px] font-extrabold leading-6 text-indigo-800 hover:no-underline sm:px-4.5">
                      <span className="flex min-w-0 items-start gap-2.5 pr-2">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-indigo-700 text-xs text-white"
                        >
                          Q
                        </span>
                        <span className="min-w-0 break-words">{item.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-5 text-[13.5px] leading-[1.85] text-neutral-600 sm:px-4.5 sm:pl-[52px]">
                      <p className="font-extrabold text-neutral-900">{item.lead}</p>
                      {item.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      <aside className="mt-5 border-l-2 border-coral-500 bg-coral-50 px-3.5 py-3 text-neutral-700">
                        <div className="flex items-start gap-2.5">
                          <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-coral-700" />
                          <div>
                            <div className="text-[12px] font-extrabold text-coral-700">{t("faqTipLabel")}</div>
                            <p className="mt-1 mb-0">{item.parentTip}</p>
                          </div>
                        </div>
                      </aside>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            </section>
          ))}
        </Accordion>
      </section>

      <section className="border-y border-indigo-200 bg-indigo-50">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-7 py-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[720px]">
            <h2 className="text-[22px] font-extrabold leading-8 text-indigo-950">{t("faqCtaTitle")}</h2>
            <p className="mt-2 text-[13.5px] leading-6 text-neutral-600">{t("faqCtaDescription")}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <Link
              href="/courses/s0"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-coral-500 px-4.5 py-2.5 text-[13px] font-extrabold text-neutral-950 transition-colors hover:bg-coral-300"
            >
              {t("faqPrimaryAction")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href="/courses/wizard"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-indigo-300 bg-white px-4.5 py-2.5 text-[13px] font-extrabold text-indigo-900 transition-colors hover:border-indigo-500 hover:bg-indigo-100"
            >
              <Wand2 aria-hidden="true" className="size-4" />
              {t("faqSecondaryAction")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
