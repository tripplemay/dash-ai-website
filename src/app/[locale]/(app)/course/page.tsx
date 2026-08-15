import { useTranslations } from "next-intl";
import { Spotlight } from "@/components/aceternity/spotlight";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "@/i18n/navigation";
import { CourseGrowth } from "@/components/course-growth";
import { WorksWall } from "@/components/works-wall";
import { MonitorPlay } from "lucide-react";
import { LABS, FAQ } from "@/lib/data";

const PATH = [
  { name: "体验中心", color: "#00B8D9" },
  { name: "创想实验室", color: "#FF7A45" },
  { name: "工程实验室", color: "#A79BFF" },
  { name: "远征实验室", color: "#5E9BFF" },
];

/** 把 **加粗** 渲染为高亮 */
function rich(text: string) {
  return text.split("**").map((seg, i) =>
    i % 2 === 1 ? (
      <b key={i} className="text-cyan-print">
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
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] px-0 pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-extrabold tracking-[2px]">
                {t("title1")}
                <em className="not-italic text-cyan">{t("title2")}</em>
              </h1>
              <div className="mt-2 text-[13.5px] tracking-wide text-[#9FB3E8]">{t("sub")}</div>
            </div>
            <Link
              href="/course/present"
              className="flex items-center gap-2 rounded-[10px] border border-cyan/50 bg-cyan/10 px-4 py-2.5 text-[13px] font-extrabold tracking-widest text-cyan transition-colors hover:bg-cyan/20"
            >
              <MonitorPlay className="size-4" />
              {t("presentEntry")}
            </Link>
          </div>
        </div>
      </section>

      {/* 进阶路径 */}
      <section className="mx-auto max-w-[1200px] px-7 py-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {t("pathTitle")} <em className="not-italic text-cyan-print">{t("pathEm")}</em>
        </h2>
        <div className="mt-4.5 mb-1.5 flex flex-wrap items-center">
          {PATH.map((p, i) => (
            <div key={p.name} className="flex min-w-0 flex-1 items-center last:flex-none">
              <div
                className="rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold whitespace-nowrap text-white"
                style={{ background: p.color }}
              >
                {p.name}
              </div>
              {i < PATH.length - 1 && <div className="h-0.5 min-w-6 flex-1 bg-[#D6E2F8]" />}
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[13.5px] text-subtext">{t("pathSub")}</div>
      </section>

      {/* 实验室与课程 */}
      <div className="mx-auto max-w-[1200px] px-7">
        {LABS.map((lab) => (
          <section key={lab.en} className="mt-8.5">
            <div className="flex items-center gap-3 border-b-2 border-[#E4EAF7] pb-3">
              <span
                className="rounded-[10px] px-3.5 py-1.5 text-xs font-extrabold tracking-widest text-white"
                style={{ background: lab.color }}
              >
                {lab.en}
              </span>
              <h2 className="text-[22px] font-extrabold tracking-wide">{lab.name}</h2>
              <span className="ml-auto rounded-[10px] bg-[#EEF4FE] px-3.5 py-1.5 text-[13px] font-extrabold text-navy">
                {lab.hours}
              </span>
            </div>
            <div className="mt-2 text-[13.5px] text-subtext">{lab.desc}</div>

            {lab.courses.map((c) => (
              <div
                key={c.name}
                className="relative mt-3.5 rounded-[14px] border border-[#E4EAF7] bg-card p-[16px_18px] transition-shadow hover:shadow-card"
              >
                <div
                  className="absolute top-3.5 bottom-3.5 left-0 w-1 rounded-sm"
                  style={{ background: lab.color }}
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[17px] font-extrabold">{c.name}</span>
                  <Badge variant="secondary" className="bg-[#EEF4FE] text-[11px] font-bold text-subtext">
                    {c.age}
                  </Badge>
                  <span className="ml-auto rounded-[9px] bg-navy px-3 py-1 text-[12.5px] font-extrabold text-white">
                    {c.count}
                  </span>
                </div>
                <div className="mt-2.5 text-[12.5px] leading-[1.8] text-subtext">{c.intro}</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {c.modules.map((m) => (
                    <span
                      key={m}
                      className="rounded-lg border border-[#E0EAF8] bg-[#F0F5FC] px-2.5 py-[3px] text-[11px] text-[#3D5A80]"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 text-[12.5px] font-extrabold text-cyan-print">
                  {t("outcome")}
                  <b className="text-navy">{c.outcome}</b>
                </div>
              </div>
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
          {t("faqTitle")} <em className="not-italic text-cyan-print">{t("faqEm")}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-subtext">{t("faqSub")}</div>
        <Accordion className="mt-3.5">
          {FAQ.map(([q, a], i) => (
            <AccordionItem
              key={i}
              value={`q-${i}`}
              className="mb-2.5 overflow-hidden rounded-xl border border-[#E4EAF7] bg-card px-0"
            >
              <AccordionTrigger className="px-4.5 py-3.5 text-[15px] font-extrabold text-navy hover:no-underline">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-navy text-xs text-white">
                    Q
                  </span>
                  {q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4.5 pb-4 pl-[52px] text-[13px] leading-[1.85] text-subtext">
                {rich(a)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
