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
import { LABS, FAQ } from "@/lib/data";
import { stageOnAccent } from "@/lib/brand";

const PATH = [
  { name: "体验中心", color: "#FC7358", href: "#pilot" },
  { name: "创想实验室", color: "#C93F78", href: "#create" },
  { name: "工程实验室", color: "#40549C", href: "#build" },
  { name: "远征实验室", color: "#1E9A91", href: "#explore" },
];

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

      {/* 进阶路径 */}
      <section id="pilot" className="mx-auto max-w-[1200px] scroll-mt-24 px-7 py-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {t("pathTitle")} <em className="not-italic text-coral-700">{t("pathEm")}</em>
        </h2>
        <div className="mt-4.5 mb-1.5 flex items-center gap-2 overflow-x-auto pb-2 sm:gap-0 sm:overflow-visible sm:pb-0">
          {PATH.map((p, i) => (
            <div key={p.name} className="flex min-w-[132px] shrink-0 items-center sm:min-w-0 sm:flex-1 sm:last:flex-none">
              <a
                href={p.href}
                className="rounded-md px-3 py-2.5 text-[13px] font-extrabold whitespace-nowrap sm:px-4 sm:text-[13.5px]"
                style={{ background: p.color, color: stageOnAccent(p.color) }}
              >
                {p.name}
              </a>
              {i < PATH.length - 1 && <div className="h-0.5 min-w-4 flex-1 bg-indigo-200 sm:min-w-6" />}
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[13.5px] text-neutral-600">{t("pathSub")}</div>
      </section>

      {/* 实验室与课程 */}
      <div className="mx-auto max-w-[1200px] px-7">
        {LABS.map((lab, index) => (
          <section key={lab.en} id={["create", "build", "explore"][index]} className="mt-8.5 scroll-mt-24">
            <div className="flex items-center gap-3 border-b-2 border-neutral-200 pb-3">
              <span
                className="rounded-md px-3.5 py-1.5 text-xs font-extrabold tracking-widest"
                style={{ background: lab.color, color: stageOnAccent(lab.color) }}
              >
                {lab.en}
              </span>
              <h2 className="text-[22px] font-extrabold tracking-wide">{lab.name}</h2>
              <span className="ml-auto rounded-md bg-indigo-50 px-3.5 py-1.5 text-[13px] font-extrabold text-indigo-800">
                {lab.hours}
              </span>
            </div>
            <div className="mt-2 text-[13.5px] text-neutral-600">{lab.desc}</div>

            {lab.courses.map((c) => (
              <Link
                key={c.name}
                href={`/courses/${c.slug}`}
                className="relative mt-3.5 block rounded-lg border border-neutral-200 bg-card p-[16px_18px] transition-shadow hover:border-indigo-300 hover:shadow-card"
              >
                <div
                  className="absolute top-3.5 bottom-3.5 left-0 w-1 rounded-sm"
                  style={{ background: lab.color }}
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[17px] font-extrabold">{c.name}</span>
                  <Badge variant="secondary" className="bg-indigo-50 text-[11px] font-bold text-neutral-600">
                    {c.age}
                  </Badge>
                  <span className="ml-auto rounded-md bg-indigo-700 px-3 py-1 text-[12.5px] font-extrabold text-white">
                    {c.count}
                  </span>
                </div>
                <div className="mt-2.5 text-[12.5px] leading-[1.8] text-neutral-600">{c.intro}</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {c.modules.map((m) => (
                    <span
                      key={m}
                      className="rounded-sm border border-indigo-100 bg-indigo-50 px-2.5 py-[3px] text-[11px] text-indigo-800"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 text-[12.5px] font-extrabold text-coral-700">
                  {t("outcome")}
                  <b className="text-indigo-800">{c.outcome}</b>
                </div>
              </Link>
            ))}
          </section>
        ))}
      </div>

      {/* 成长体系 · 能力认证阶梯 */}
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
