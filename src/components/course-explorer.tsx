"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, LayoutGrid, Target } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { LabCourse } from "@/lib/data";
import type { LessonDetail } from "@/lib/lesson-content";

interface Props {
  lab: { name: string; color: string };
  course: LabCourse;
  lessons: LessonDetail[];
  siblings: { slug: string; name: string }[];
  initial: number; // 0 = 课程总览
}

/** 课堂环节条目「环节名：简述」拆分；无分隔符时整段作为环节名 */
function splitStep(step: string): [string, string] {
  const i = step.indexOf("：");
  return i === -1 ? [step, ""] : [step.slice(0, i), step.slice(i + 1)];
}

export function CourseExplorer({ lab, course, lessons, siblings, initial }: Props) {
  const t = useTranslations("course");
  const [cur, setCur] = useState(initial);
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // 深链直达（如 drone ?lesson=25）时，把左栏滚动到当前选中项
  useEffect(() => {
    sidebarRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
    // 仅在首次挂载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, lessons.length));
      setCur(next);
      const url = window.location.pathname + (next === 0 ? "" : `?lesson=${next}`);
      window.history.replaceState(null, "", url);
      contentRef.current?.scrollIntoView({ block: "start" });
    },
    [lessons.length]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        select(cur + 1);
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        select(cur - 1);
      }
    },
    [cur, select]
  );

  const items = [
    { n: 0, title: t("detailOverview") },
    ...lessons.map((l) => ({ n: l.n, title: l.title })),
  ];

  /** 左栏/顶部条共用的导航项 */
  const navButton = (item: { n: number; title: string }, mobile: boolean) => {
    const active = cur === item.n;
    return (
      <button
        key={item.n}
        onClick={() => select(item.n)}
        aria-current={active}
        className={
          mobile
            ? `flex shrink-0 items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-extrabold whitespace-nowrap transition-colors ${
                active ? "border-transparent text-white" : "border-[#E4EAF7] bg-card text-navy"
              }`
            : `flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-bold transition-colors ${
                active ? "text-white" : "text-navy hover:bg-[#F0F5FC]"
              }`
        }
        style={active ? { background: lab.color } : undefined}
      >
        {item.n === 0 ? (
          <span
            className={`flex size-5.5 shrink-0 items-center justify-center rounded-[6px] ${
              active ? "bg-white/25 text-white" : "text-white"
            }`}
            style={active ? undefined : { background: lab.color }}
          >
            <LayoutGrid className="size-3" />
          </span>
        ) : (
          <span
            className={`flex size-5.5 shrink-0 items-center justify-center rounded-[6px] text-[10.5px] font-extrabold text-white ${
              active ? "bg-white/25" : ""
            }`}
            style={active ? undefined : { background: lab.color }}
          >
            {item.n}
          </span>
        )}
        <span className={mobile ? "" : "truncate"}>{item.title}</span>
      </button>
    );
  };

  const lesson = cur > 0 ? lessons[cur - 1] : null;

  return (
    <div className="mx-auto max-w-[1200px] px-7 py-8.5 md:flex md:items-start md:gap-6">
      {/* 移动端：顶部横向滚动 chips */}
      <div className="-mx-7 mb-5 flex gap-2 overflow-x-auto px-7 pb-1 md:hidden">
        {items.map((it) => navButton(it, true))}
      </div>

      {/* 桌面端：左栏课表（sticky + 独立滚动） */}
      <aside
        ref={sidebarRef}
        className="sticky top-[78px] hidden max-h-[calc(100vh-102px)] w-[236px] shrink-0 flex-col gap-0.5 overflow-y-auto rounded-[14px] border border-[#E4EAF7] bg-card p-2 md:flex"
      >
        {items.map((it) => navButton(it, false))}
      </aside>

      {/* 右栏内容区（聚焦时 ↑/↓ 切换） */}
      <div
        ref={contentRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 scroll-mt-[78px] outline-none"
      >
        {lesson === null ? (
          <>
            {/* 课程总览：简介 + 模块 + 结课产出大卡 */}
            <section>
              <h2 className="text-[22px] font-extrabold tracking-[2px]">{t("detailIntro")}</h2>
              <div className="mt-3 rounded-[14px] border border-[#E4EAF7] bg-card p-[18px_20px] text-[13.5px] leading-[1.9] text-subtext">
                <p>{course.intro}</p>
                <p className="mt-2">{course.reality}</p>
              </div>
            </section>

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

            <section className="mt-8.5">
              <div className="rounded-[14px] bg-[linear-gradient(135deg,#101C52,#1B2A6B)] p-[18px_20px] text-white">
                <div className="text-[12px] font-extrabold tracking-[3px] text-cyan">
                  {t("detailOutcome")}
                </div>
                <div className="mt-2 text-[17px] font-extrabold tracking-wide">{course.outcome}</div>
              </div>
            </section>

            {/* 总览页底部：返回 + 同主题课程 */}
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
          </>
        ) : (
          <>
            {/* 单节课：固定四段框架 */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-[9px] px-3 py-1 text-[12.5px] font-extrabold text-white"
                style={{ background: lab.color }}
              >
                {t("detailLessonNo", { n: lesson.n })}
              </span>
              <h2 className="text-[26px] font-extrabold tracking-[1px] text-navy">{lesson.title}</h2>
            </div>

            <section className="mt-6">
              <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("detailSummary")}</h3>
              <div className="mt-2.5 rounded-[14px] border border-[#E4EAF7] bg-card p-[16px_18px] text-[13.5px] leading-[1.9] text-subtext">
                {lesson.summary}
              </div>
            </section>

            <section className="mt-7">
              <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("detailGoals")}</h3>
              <ul className="mt-2.5 space-y-2">
                {lesson.goals.map((g) => (
                  <li
                    key={g}
                    className="flex items-center gap-2.5 rounded-[12px] border border-[#E4EAF7] bg-card px-3.5 py-2.5 text-[13px] font-bold text-navy"
                  >
                    <Target className="size-4 shrink-0" style={{ color: lab.color }} />
                    {g}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-7">
              <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("detailOutline")}</h3>
              <ol className="mt-2.5">
                {lesson.outline.map((step, i) => {
                  const [name, desc] = splitStep(step);
                  return (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < lesson.outline.length - 1 && (
                        <span className="absolute top-7 left-[13px] h-[calc(100%-28px)] w-0.5 bg-[#D6E2F8]" />
                      )}
                      <span
                        className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-extrabold text-white"
                        style={{ background: lab.color }}
                      >
                        {i + 1}
                      </span>
                      <div className="pt-0.5 text-[13px] leading-[1.8]">
                        <b className="text-navy">{name}</b>
                        {desc && <span className="text-subtext">：{desc}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="mt-7">
              <div className="relative overflow-hidden rounded-[12px] border border-[#E4EAF7] bg-[#F0F5FC] p-[14px_16px]">
                <span
                  className="absolute top-0 bottom-0 left-0 w-1"
                  style={{ background: lab.color }}
                />
                <div className="text-[11px] font-extrabold tracking-[3px]" style={{ color: lab.color }}>
                  {t("detailOutcome")}
                </div>
                <div className="mt-1 text-[14.5px] font-extrabold text-navy">{lesson.output}</div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
