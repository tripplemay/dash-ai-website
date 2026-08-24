"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LABS, GROWTH_LAYERS, LEARNING_LOOP, GROWTH_ENTRIES, GROWTH_ENTRIES_NOTE } from "@/lib/data";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { CORECOORD_ASSET_ROOT, CORECOORD_STAGES, stageOnAccent } from "@/lib/brand";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const TOTAL = 9;
const PREVIEW_ROOT = `${CORECOORD_ASSET_ROOT}/vi-system-2026/deliverables/previews`;
const PRESENTATION_COVER_PREVIEW = `${PREVIEW_ROOT}/corecoord-presentation-cover-16x9.png`;
const STAGE_PALETTE_PREVIEW = `${PREVIEW_ROOT}/corecoord-stage-palette.png`;
const VIDEO_COVER_PREVIEW = `${PREVIEW_ROOT}/corecoord-video-cover-16x9.png`;
const COORDINATE_FIELD_PREVIEW = `${PREVIEW_ROOT}/corecoord-coordinate-field-light.png`;

function slideFromSearch(search: string, total: number): number {
  const raw = Number(new URLSearchParams(search).get("slide"));
  return Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), total) : 1;
}

function isNearbySlide(index: number, active: number, total: number) {
  const distance = Math.abs(index - active);
  return distance <= 1 || distance >= total - 1;
}

function PresentDeck() {
  const router = useRouter();
  const locale = useLocale();
  const sp = useSearchParams();
  const search = sp.toString();
  const initial = slideFromSearch(search, TOTAL);
  const [idx, setIdx] = useState(initial - 1); // 0-based
  const [cursorOn, setCursorOn] = useState(true);
  const idxRef = useRef(initial - 1);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const brandLogoAlt = locale === "zh" ? "芯坐标" : "CORECOORD";
  const exitLabel = locale === "zh" ? "退出课程演示" : "Exit presentation";
  const prevLabel = locale === "zh" ? "上一页" : "Previous slide";
  const nextLabel = locale === "zh" ? "下一页" : "Next slide";

  const updateSlideUrl = useCallback((slide: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("slide", String(slide));
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }, []);

  const go = useCallback(
    (i: number) => {
      const next = ((i % TOTAL) + TOTAL) % TOTAL;
      idxRef.current = next;
      setIdx(next);
      updateSlideUrl(next + 1);
    },
    [updateSlideUrl]
  );
  const next = useCallback(() => go(idxRef.current + 1), [go]);
  const prev = useCallback(() => go(idxRef.current - 1), [go]);
  const exit = useCallback(() => router.push("/courses"), [router]);

  const wake = useCallback(() => {
    setCursorOn(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setCursorOn(false), 3000);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      touchStartX.current = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? null;
      wake();
    },
    [wake]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start === null) return;
      const end = e.changedTouches[0]?.clientX ?? e.touches[0]?.clientX;
      if (end === undefined || Math.abs(end - start) < 40) return;
      if (end < start) next();
      else prev();
      wake();
    },
    [next, prev, wake]
  );

  // Native history updates are integrated with the Next router; this restores
  // the visible slide when the user presses browser Back/Forward.
  useEffect(() => {
    const nextSlide = slideFromSearch(search, TOTAL) - 1;
    if (nextSlide !== idxRef.current) {
      idxRef.current = nextSlide;
      setIdx(nextSlide);
    }
  }, [search]);

  useEffect(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setCursorOn(false), 3000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight" || e.code === "Space") {
        e.preventDefault();
        next();
      }
      if (e.code === "ArrowLeft") prev();
      if (e.code === "Escape") {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", wake);
      if (idle.current) clearTimeout(idle.current);
    };
  }, [next, prev, exit, wake]);

  const show = (i: number) => cn(
    "absolute inset-0 transition-opacity duration-700 ease-in-out",
    // Keep only adjacent slides in the render tree's layout/paint path. The
    // deck contains large poster assets, so this prevents hidden slides from
    // competing for memory while preserving the cross-fade to the next slide.
    isNearbySlide(i, idx, TOTAL) ? (i === idx ? "opacity-100" : "pointer-events-none opacity-0") : "hidden"
  );

  return (
    <div
      className={cn("fixed inset-0 z-[60] bg-reverse-background text-white", !cursorOn && "cursor-none")}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={exit}
        aria-label={exitLabel}
        title={exitLabel}
        className="fixed top-5 right-5 z-20 inline-flex size-11 items-center justify-center rounded-[4px] border border-white/30 bg-reverse-background/90 text-white transition-colors hover:bg-core-indigo focus-visible:ring-[3px] focus-visible:ring-signal-coral"
      >
        <X className="size-5" />
      </button>

      <div
        className={cn(
          "fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 transition-opacity duration-500",
          !cursorOn && "pointer-events-none opacity-0"
        )}
      >
        <button
          type="button"
          onClick={prev}
          aria-label={prevLabel}
          title={prevLabel}
          className="inline-flex size-11 items-center justify-center rounded-[4px] border border-white/30 bg-reverse-background/90 text-white transition-colors hover:bg-core-indigo focus-visible:ring-[3px] focus-visible:ring-signal-coral"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={nextLabel}
          title={nextLabel}
          className="inline-flex size-11 items-center justify-center rounded-[4px] border border-white/30 bg-reverse-background/90 text-white transition-colors hover:bg-core-indigo focus-visible:ring-[3px] focus-visible:ring-signal-coral"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* 1 · 品牌定位 */}
      <section className={show(0)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PRESENTATION_COVER_PREVIEW}
          alt=""
          loading={idx === 0 ? "eager" : "lazy"}
          fetchPriority={idx === 0 ? "high" : "low"}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-reverse-background/75" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <BrandLogo variant="stacked-reverse" alt={brandLogoAlt} width={176} height={176} className="h-28 w-28 sm:h-36 sm:w-36" priority />
          <h1 className="mt-5 text-[36px] leading-tight font-extrabold tracking-[2px] sm:mt-8 sm:text-[52px] lg:text-[72px] lg:tracking-[4px]">
            {locale === "zh" ? "有方向的创造" : "Create with direction"}
          </h1>
          <div className="mt-4 text-[16px] font-bold tracking-[2px] text-white/80 sm:mt-6 sm:text-[22px] sm:tracking-[4px] lg:text-[28px] lg:tracking-[6px]">有方向的创造 · 合作伙伴课程介绍</div>
          <div className="mt-7 inline-flex w-fit rounded-[4px] border border-signal-coral/60 bg-signal-coral/15 px-5 py-3 text-[20px] font-extrabold tracking-[2px] text-signal-coral sm:mt-12 sm:px-8 sm:py-4 sm:text-[28px] lg:text-[32px] lg:tracking-[4px]">
            在 AI 世界，找到自己的坐标。
          </div>
        </div>
      </section>

      {/* 2 · 课程体系总览 */}
      <section className={show(1)}>
        <div className="absolute inset-0 bg-reverse-background" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COORDINATE_FIELD_PREVIEW} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="relative flex h-full flex-col items-center justify-center px-5">
          <div className="text-[22px] font-extrabold tracking-[8px] text-white/65">课程体系总览</div>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-14 sm:gap-10 lg:gap-24">
            {[
              { n: "9", u: "大课程域" },
              { n: "135", u: "课次" },
              { n: "4", u: "项能力轴" },
            ].map((s) => (
              <div key={s.u} className="text-center">
                <div className="text-[48px] leading-none font-extrabold text-signal-coral sm:text-[80px] lg:text-[120px]">{s.n}</div>
                <div className="mt-2 text-[12px] font-bold tracking-wide text-white sm:mt-4 sm:text-[20px] lg:text-[26px] lg:tracking-[3px]">{s.u}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 px-5 text-center text-[15px] text-white/75 sm:mt-14 sm:text-[22px] lg:text-[24px]">创作 · 工程 · 素养三大方向 · 五步闭环</div>
        </div>
      </section>

      {/* 3–5 · 三大方向 */}
      {LABS.map((lab, i) => (
        <section key={lab.en} className={show(2 + i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STAGE_PALETTE_PREVIEW}
            alt=""
            loading={idx === 2 + i ? "eager" : "lazy"}
            fetchPriority={idx === 2 + i ? "high" : "low"}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-reverse-background/80" />
          <div className="relative flex h-full flex-col justify-end px-6 pb-20 sm:px-10 sm:pb-24 lg:px-24">
            <span
              className="w-fit rounded-[4px] px-4 py-1.5 text-[14px] font-extrabold tracking-[2px] sm:px-5 sm:py-2 sm:text-[18px] sm:tracking-[3px] lg:text-[20px] lg:tracking-[4px]"
              style={{ background: lab.color, color: stageOnAccent(lab.color) }}
            >
              {lab.en}
            </span>
            <h2 className="mt-4 text-[34px] font-extrabold tracking-[2px] sm:mt-6 sm:text-[50px] lg:text-[64px] lg:tracking-[4px]">
              {lab.name}
              <span className="ml-3 align-middle text-[14px] font-bold text-white/75 sm:ml-6 sm:text-[22px] lg:text-[26px]">{lab.hours}</span>
            </h2>
            <div className="mt-2 text-[15px] text-white/80 sm:mt-3 sm:text-[20px] lg:text-[24px]">{lab.desc}</div>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-8 sm:gap-4">
              {lab.courses.map((c) => (
                <div key={c.name} className="rounded-[8px] border border-white/20 bg-white/10 px-6 py-4">
                  <span className="text-[24px] font-extrabold">{c.name}</span>
                  <span className="ml-3 text-[16px] text-white/70">
                    {c.age} · {c.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* 6 · 四项能力轴 */}
      <section className={show(5)}>
        <div className="absolute inset-0 bg-reverse-background" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COORDINATE_FIELD_PREVIEW} alt="" className="absolute inset-0 h-full w-full object-cover opacity-10" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <div className="text-[22px] font-extrabold tracking-[8px] text-white/65">课程框架</div>
          <h2 className="mt-3 text-[34px] font-extrabold tracking-[2px] sm:mt-4 sm:text-[44px] lg:text-[52px] lg:tracking-[3px]">
            四项<em className="not-italic text-signal-coral">能力轴</em>
          </h2>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:mt-14 lg:flex-row lg:gap-6">
            {GROWTH_LAYERS.map((l, i) => (
              <div key={l.level} className="flex flex-1 items-center gap-3 lg:gap-6">
                <div
                  className="flex-1 rounded-[8px] border border-white/15 bg-white/8 p-6"
                  style={{ borderTop: `4px solid ${l.color}`, transform: `translateY(${(3 - i) * -18}px)` }}
                >
                  <div className="text-[30px] font-extrabold" style={{ color: l.color }}>{l.level}</div>
                  <div className="mt-2 text-[26px] font-extrabold">{l.title}</div>
                  <div className="mt-2 text-[15px] leading-relaxed text-white/70">{l.tagline}</div>
                </div>
                {i < GROWTH_LAYERS.length - 1 && <div className="hidden text-[28px] text-signal-coral/75 lg:block">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · 五步闭环 */}
      <section className={show(6)}>
        <div className="absolute inset-0 bg-reverse-background" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COORDINATE_FIELD_PREVIEW} alt="" className="absolute inset-0 h-full w-full object-cover opacity-10" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <h2 className="text-[32px] font-extrabold tracking-[2px] sm:text-[44px] lg:text-[52px] lg:tracking-[3px]">
            课堂<em className="not-italic text-signal-coral">五步闭环</em>
          </h2>
          <div className="mt-3 text-[22px] text-white/75">明确目标 → 设计提示 → 协作生成 → 评估迭代 → 展示发布</div>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-5 sm:gap-4">
            {LEARNING_LOOP.map((step, i) => (
              <div key={step} className="flex flex-col items-center rounded-[8px] border border-white/15 bg-white/10 px-3 py-5 text-center">
                <div className="flex size-[58px] items-center justify-center rounded-full border-2 border-signal-coral text-[22px] font-extrabold text-signal-coral">
                  {i + 1}
                </div>
                <div className="mt-3 text-[15px] font-bold text-white">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · 课程进阶路径 */}
      <section className={show(7)}>
        <div className="absolute inset-0 bg-reverse-background" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COORDINATE_FIELD_PREVIEW} alt="" className="absolute inset-0 h-full w-full object-cover opacity-10" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <h2 className="text-[32px] font-extrabold tracking-[2px] sm:text-[44px] lg:text-[52px] lg:tracking-[3px]">
            课程进阶 · <em className="not-italic text-signal-coral">不绑定年龄</em>
          </h2>
          <div className="mt-8 space-y-5 sm:mt-12 sm:space-y-8">
            {GROWTH_ENTRIES.map((e, i) => (
              <div key={e.key} className="flex items-center gap-6">
                {(() => {
                  const color = i === 0 ? CORECOORD_STAGES["00"].accent : CORECOORD_STAGES["04"].accent;
                  return (
                    <span
                      className="rounded-[4px] px-4 py-3 text-[16px] font-extrabold sm:px-6 sm:py-4 sm:text-[22px] lg:text-[24px]"
                      style={{ background: color, color: stageOnAccent(color) }}
                    >
                      {e.key}
                    </span>
                  );
                })()}
                <span className="text-[20px] text-signal-coral sm:text-[26px] lg:text-[28px]">→</span>
                <span className="text-[17px] font-bold text-white sm:text-[22px] lg:text-[26px]">{e.path}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 w-fit rounded-[4px] border border-signal-coral/35 bg-signal-coral/10 px-5 py-3 text-[16px] font-extrabold text-signal-coral sm:mt-12 sm:px-8 sm:py-4 sm:text-[22px] lg:text-[24px]">
            {GROWTH_ENTRIES_NOTE}
          </div>
        </div>
      </section>

      {/* 9 · 结尾 CTA */}
      <section className={show(8)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={VIDEO_COVER_PREVIEW}
          alt=""
          loading={idx === 8 ? "eager" : "lazy"}
          fetchPriority={idx === 8 ? "high" : "low"}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-reverse-background/80" />
        <div className="relative flex h-full items-center px-6 sm:px-10 lg:px-24">
          <div>
            <BrandLogo variant="mark-reverse" alt={brandLogoAlt} width={80} height={80} className="mb-8 size-16 sm:size-20" priority />
            <h2 className="text-[36px] leading-tight font-extrabold tracking-[2px] sm:text-[52px] lg:text-[64px] lg:tracking-[4px]">
              体验课<em className="not-italic text-signal-coral">预约</em>
            </h2>
            <div className="mt-4 text-[15px] leading-relaxed text-white/80 sm:mt-6 sm:text-[21px] lg:text-[26px]">
              理解 AI，创造作品，形成判断。
              <br />
              看见过程，也看见成长。
            </div>
            <div className="mt-6 inline-flex rounded-[4px] bg-signal-coral px-5 py-3 text-[18px] font-extrabold tracking-[2px] text-[#171C25] sm:mt-10 sm:px-8 sm:py-4 sm:text-[25px] lg:px-10 lg:py-5 lg:text-[30px] lg:tracking-[3px]">
              查看课程项目
            </div>
          </div>
        </div>
      </section>

      {/* 页码指示器 */}
      <div
        aria-live="polite"
        className="fixed right-8 bottom-6 rounded-[4px] border border-white/20 bg-reverse-background/90 px-5 py-2 text-[15px] font-extrabold tracking-[3px] text-white/85"
      >
        {idx + 1} / {TOTAL}
      </div>
    </div>
  );
}

export default function CoursePresentPage() {
  return (
    <Suspense>
      <PresentDeck />
    </Suspense>
  );
}
