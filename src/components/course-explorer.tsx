"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid, Search, Target } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { LabCourse } from "@/lib/data";
import type { LessonDetail } from "@/lib/lesson-content";
import { stageOnAccent } from "@/lib/brand";

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
  const [lessonQuery, setLessonQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // 深链直达（如 drone ?lesson=25）时，把左栏滚动到当前选中项
  useEffect(() => {
    sidebarRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
    // 仅在首次挂载时执行
  }, []);

  const select = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, lessons.length));
      setCur(next);
      const params = new URLSearchParams(window.location.search);
      if (next === 0) params.delete("lesson");
      else params.set("lesson", String(next));
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.pushState(null, "", url);
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

  useEffect(() => {
    const onPopState = () => {
      const raw = Number(new URLSearchParams(window.location.search).get("lesson"));
      const next = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), lessons.length) : 0;
      setCur(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [lessons.length]);

  /** 左栏/顶部条共用的导航项 */
  const navButton = (item: { n: number; title: string }, mobile: boolean) => {
    const active = cur === item.n;
    return (
      <button
        key={item.n}
        onClick={() => select(item.n)}
        aria-current={active ? "page" : undefined}
        className={
          mobile
            ? `flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-[12px] font-extrabold whitespace-nowrap transition-colors ${
                active ? "border-transparent" : "border-neutral-200 bg-card text-indigo-800"
              }`
            : `flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] font-bold transition-colors ${
                active ? "" : "text-indigo-800 hover:bg-indigo-50"
              }`
        }
        style={active ? { background: lab.color, color: stageOnAccent(lab.color) } : undefined}
      >
        {item.n === 0 ? (
          <span
            className="flex size-5.5 shrink-0 items-center justify-center rounded-sm bg-white/25"
            style={{ color: stageOnAccent(lab.color), ...(active ? {} : { background: lab.color }) }}
          >
            <LayoutGrid className="size-3" />
          </span>
        ) : (
          <span
            className="flex size-5.5 shrink-0 items-center justify-center rounded-sm text-[10.5px] font-extrabold bg-white/25"
            style={{ color: stageOnAccent(lab.color), ...(active ? {} : { background: lab.color }) }}
          >
            {item.n}
          </span>
        )}
        <span className={mobile ? "" : "truncate"}>{item.title}</span>
      </button>
    );
  };

  const lesson = cur > 0 ? lessons[cur - 1] : null;
  const filteredLessons = lessons.filter((item) => {
    const q = lessonQuery.trim().toLowerCase();
    return !q || item.title.toLowerCase().includes(q) || String(item.n).includes(q);
  });
  const filteredItems = [
    { n: 0, title: t("detailOverview") },
    ...filteredLessons.map((l) => ({ n: l.n, title: l.title })),
  ];
  const previous = cur > 0 ? cur - 1 : null;
  const next = cur < lessons.length ? cur + 1 : null;

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-7 sm:py-8.5 md:flex md:items-start md:gap-6">
      {/* 移动端：搜索 + 原生选择器，避免 135 个横向 chips 难以定位 */}
      <div className="mb-5 md:hidden">
        <label className="relative block">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={lessonQuery}
            onChange={(event) => setLessonQuery(event.target.value)}
            placeholder={t("lessonSearch")}
            aria-label={t("lessonSearch")}
            className="h-10 w-full rounded-md border border-neutral-200 bg-card pr-3 pl-9 text-[13px] outline-none focus:border-coral-700"
          />
        </label>
        <select
          value={cur}
          onChange={(event) => select(Number(event.target.value))}
          aria-label={t("lessonSelect")}
          className="mt-2.5 h-11 w-full rounded-md border border-neutral-200 bg-card px-3 text-[13px] font-bold text-indigo-800 outline-none focus:border-coral-700"
        >
          {filteredItems.map((it) => (
            <option key={it.n} value={it.n}>
              {it.n === 0 ? it.title : `${it.n}. ${it.title}`}
            </option>
          ))}
        </select>
      </div>

      {/* 桌面端：左栏课表（sticky + 独立滚动） */}
      <aside
        ref={sidebarRef}
        className="sticky top-[78px] hidden max-h-[calc(100vh-102px)] w-[236px] shrink-0 flex-col gap-0.5 overflow-y-auto rounded-lg border border-neutral-200 bg-card p-2 md:flex"
      >
        <label className="relative mb-2 block">
          <Search aria-hidden="true" className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={lessonQuery}
            onChange={(event) => setLessonQuery(event.target.value)}
            placeholder={t("lessonSearch")}
            aria-label={t("lessonSearch")}
            className="h-8 w-full rounded-sm border border-neutral-200 bg-neutral-50 pr-2 pl-8 text-[11px] outline-none focus:border-coral-700"
          />
        </label>
        {filteredItems.map((it) => navButton(it, false))}
      </aside>

      {/* 右栏内容区（聚焦时 ↑/↓ 切换） */}
      <div
        ref={contentRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={t("lessonContent")}
        className="min-w-0 flex-1 scroll-mt-[78px] outline-none"
      >
        {lesson === null ? (
          <>
            {/* 课程总览：简介 + 模块 + 结课产出大卡 */}
            <section>
              <h2 className="text-[22px] font-extrabold tracking-[2px]">{t("detailIntro")}</h2>
              <div className="mt-3 rounded-lg border border-neutral-200 bg-card p-[18px_20px] text-[13.5px] leading-[1.9] text-muted-foreground">
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
                    className="rounded-sm border border-indigo-100 bg-indigo-50 px-2.5 py-[3px] text-[11.5px] text-indigo-800"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </section>

            <section className="mt-8.5">
              <div className="rounded-lg bg-reverse-background p-[18px_20px] text-white">
                <div className="text-[12px] font-extrabold tracking-[3px] text-signal-coral">
                  {t("detailOutcome")}
                </div>
                <div className="mt-2 text-[17px] font-extrabold tracking-wide">{course.outcome}</div>
              </div>
            </section>

            {/* 总览页底部：返回 + 同主题课程 */}
            <section className="mt-8.5 flex flex-wrap items-center gap-2.5 border-t-2 border-neutral-200 pt-6">
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-card px-4 py-2.5 text-[12.5px] font-extrabold text-indigo-800 transition-colors hover:border-coral-700 hover:text-coral-700"
              >
                <ArrowLeft className="size-3.5" />
                {t("detailBack")}
              </Link>
              {siblings.length > 0 && (
                <>
                  <span className="ml-2 text-[12px] font-bold text-muted-foreground">{t("detailSibling")}</span>
                  {siblings.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/courses/${c.slug}`}
                      className="rounded-md px-4 py-2.5 text-[12.5px] font-extrabold transition-opacity hover:opacity-85"
                      style={{ background: lab.color, color: stageOnAccent(lab.color) }}
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
                className="rounded-md px-3 py-1 text-[12.5px] font-extrabold"
                style={{ background: lab.color, color: stageOnAccent(lab.color) }}
              >
                {t("detailLessonNo", { n: lesson.n })}
              </span>
              <h2 className="text-[26px] font-extrabold tracking-[1px] text-indigo-800">{lesson.title}</h2>
            </div>

            <section className="mt-6">
              <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("detailSummary")}</h3>
              <div className="mt-2.5 rounded-lg border border-neutral-200 bg-card p-[16px_18px] text-[13.5px] leading-[1.9] text-muted-foreground">
                {lesson.summary}
              </div>
            </section>

            <section className="mt-7">
              <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("detailGoals")}</h3>
              <ul className="mt-2.5 space-y-2">
                {lesson.goals.map((g) => (
                  <li
                    key={g}
                    className="flex items-center gap-2.5 rounded-md border border-neutral-200 bg-card px-3.5 py-2.5 text-[13px] font-bold text-indigo-800"
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
                        <span className="absolute top-7 left-[13px] h-[calc(100%-28px)] w-0.5 bg-indigo-200" />
                      )}
                      <span
                        className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md text-[11.5px] font-extrabold"
                        style={{ background: lab.color, color: stageOnAccent(lab.color) }}
                      >
                        {i + 1}
                      </span>
                      <div className="pt-0.5 text-[13px] leading-[1.8]">
                        <b className="text-indigo-800">{name}</b>
                        {desc && <span className="text-muted-foreground">：{desc}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="mt-7">
              <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-indigo-50 p-[14px_16px]">
                <span
                  className="absolute top-0 bottom-0 left-0 w-1"
                  style={{ background: lab.color }}
                />
                <div className="text-[11px] font-extrabold tracking-[3px]" style={{ color: lab.color }}>
                  {t("detailOutcome")}
                </div>
                <div className="mt-1 text-[14.5px] font-extrabold text-indigo-800">{lesson.output}</div>
              </div>
            </section>

            <nav aria-label={t("lessonPagination")} className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t-2 border-neutral-200 pt-5">
              {previous === null ? <span /> : (
                <button
                  type="button"
                  onClick={() => select(previous)}
                  className="inline-flex max-w-[48%] items-center gap-1.5 rounded-md border border-neutral-200 bg-card px-3.5 py-2.5 text-left text-[12px] font-extrabold text-indigo-800 hover:border-coral-700"
                >
                  <ChevronLeft className="size-4 shrink-0" />
                  <span className="truncate">{t("previousLesson")}</span>
                </button>
              )}
              {next === null ? <span /> : (
                <button
                  type="button"
                  onClick={() => select(next)}
                  className="ml-auto inline-flex max-w-[48%] items-center gap-1.5 rounded-md border border-neutral-200 bg-card px-3.5 py-2.5 text-right text-[12px] font-extrabold text-indigo-800 hover:border-coral-700"
                >
                  <span className="truncate">{t("nextLesson")}</span>
                  <ChevronRight className="size-4 shrink-0" />
                </button>
              )}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
