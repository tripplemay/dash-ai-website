"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LABS, GROWTH_LAYERS, GROWTH_BADGES, GROWTH_ENTRIES, GROWTH_ENTRIES_NOTE } from "@/lib/data";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assets";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const TOTAL = 9;

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
      className={cn("fixed inset-0 z-[60] bg-midnight text-white", !cursorOn && "cursor-none")}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={exit}
        aria-label={exitLabel}
        title={exitLabel}
        className="fixed top-5 right-5 z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-cyan"
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
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-cyan"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={nextLabel}
          title={nextLabel}
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-cyan"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* 1 · 品牌定位 */}
      <section className={show(0)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/img/cover-bg.png"
          alt=""
          loading={idx === 0 ? "eager" : "lazy"}
          fetchPriority={idx === 0 ? "high" : "low"}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,14,40,.9),rgba(8,14,40,.4))]" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/logo/DASH-mark-dark_1024.png" alt="" className="logo-rounded size-20 object-cover" />
          <h1 className="mt-5 text-[36px] leading-tight font-extrabold tracking-[2px] sm:mt-8 sm:text-[52px] lg:text-[72px] lg:tracking-[4px]">
            DASH <em className="not-italic text-cyan">AI</em> 实验室
          </h1>
          <div className="mt-4 text-[16px] font-bold tracking-[2px] text-[#BFEFFF] sm:mt-6 sm:text-[22px] sm:tracking-[4px] lg:text-[28px] lg:tracking-[6px]">少儿 AI 素养课程 · 合作伙伴课程介绍</div>
          <div className="mt-7 inline-flex w-fit rounded-2xl border border-cyan/40 bg-cyan/10 px-5 py-3 text-[20px] font-extrabold tracking-[2px] text-cyan sm:mt-12 sm:px-8 sm:py-4 sm:text-[28px] lg:text-[32px] lg:tracking-[4px]">
            兴趣是入口，能力是出口
          </div>
        </div>
      </section>

      {/* 2 · 数字总览 */}
      <section className={show(1)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#1B2A6B)]" />
        <div className="relative flex h-full flex-col items-center justify-center px-5">
          <div className="text-[22px] font-extrabold tracking-[8px] text-[#9FB3E8]">课程体系总览</div>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-14 sm:gap-10 lg:gap-24">
            {[
              { n: "9", u: "大能力实验室" },
              { n: "132", u: "课时" },
              { n: "5–16", u: "岁覆盖" },
            ].map((s) => (
              <div key={s.u} className="text-center">
                <div className="text-[48px] leading-none font-extrabold text-cyan sm:text-[80px] lg:text-[120px]">{s.n}</div>
                <div className="mt-2 text-[12px] font-bold tracking-wide text-white sm:mt-4 sm:text-[20px] lg:text-[26px] lg:tracking-[3px]">{s.u}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 px-5 text-center text-[15px] text-[#BFEFFF] sm:mt-14 sm:text-[22px] lg:text-[24px]">AIGC 创作 · 编程工程 · 智能硬件 三大方向</div>
        </div>
      </section>

      {/* 3–5 · 三大实验室 */}
      {LABS.map((lab, i) => (
        <section key={lab.en} className={show(2 + i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(`/assets/ext/实验室海报-${i + 1}.png`)}
            alt=""
            loading={idx === 2 + i ? "eager" : "lazy"}
            fetchPriority={idx === 2 + i ? "high" : "low"}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,14,40,.92),rgba(8,14,40,.25))]" />
          <div className="relative flex h-full flex-col justify-end px-6 pb-20 sm:px-10 sm:pb-24 lg:px-24">
            <span
              className="w-fit rounded-xl px-4 py-1.5 text-[14px] font-extrabold tracking-[2px] text-white sm:px-5 sm:py-2 sm:text-[18px] sm:tracking-[3px] lg:text-[20px] lg:tracking-[4px]"
              style={{ background: lab.color }}
            >
              {lab.en}
            </span>
            <h2 className="mt-4 text-[34px] font-extrabold tracking-[2px] sm:mt-6 sm:text-[50px] lg:text-[64px] lg:tracking-[4px]">
              {lab.name}
              <span className="ml-3 align-middle text-[14px] font-bold text-[#BFEFFF] sm:ml-6 sm:text-[22px] lg:text-[26px]">{lab.hours}</span>
            </h2>
            <div className="mt-2 text-[15px] text-[#BFEFFF] sm:mt-3 sm:text-[20px] lg:text-[24px]">{lab.desc}</div>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-8 sm:gap-4">
              {lab.courses.map((c) => (
                <div key={c.name} className="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-sm">
                  <span className="text-[24px] font-extrabold">{c.name}</span>
                  <span className="ml-3 text-[16px] text-[#BFEFFF]">
                    {c.age} · {c.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* 6 · 成长体系阶梯 */}
      <section className={show(5)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#101C52)]" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <div className="text-[22px] font-extrabold tracking-[8px] text-[#9FB3E8]">成长体系</div>
          <h2 className="mt-3 text-[34px] font-extrabold tracking-[2px] sm:mt-4 sm:text-[44px] lg:text-[52px] lg:tracking-[3px]">
            能力认证<em className="not-italic text-cyan">阶梯</em>
          </h2>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:mt-14 lg:flex-row lg:gap-6">
            {GROWTH_LAYERS.map((l, i) => (
              <div key={l.level} className="flex flex-1 items-center gap-3 lg:gap-6">
                <div
                  className="flex-1 rounded-2xl bg-white/8 p-6 backdrop-blur-sm"
                  style={{ borderTop: `4px solid ${l.color}`, transform: `translateY(${(3 - i) * -18}px)` }}
                >
                  <div className="text-[30px] font-extrabold" style={{ color: l.color }}>{l.level}</div>
                  <div className="mt-2 text-[26px] font-extrabold">{l.title}</div>
                  <div className="mt-2 text-[15px] leading-relaxed text-[#BFEFFF]">{l.tagline}</div>
                </div>
                {i < GROWTH_LAYERS.length - 1 && <div className="hidden text-[28px] text-cyan/60 lg:block">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · 九枚认证徽章 */}
      <section className={show(6)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#1B2A6B)]" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <h2 className="text-[32px] font-extrabold tracking-[2px] sm:text-[44px] lg:text-[52px] lg:tracking-[3px]">
            九枚<em className="not-italic text-cyan">实验室认证徽章</em>
          </h2>
          <div className="mt-3 text-[22px] text-[#BFEFFF]">每通过一座实验室的项目评估，即点亮一项能力认证</div>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-12 sm:grid-cols-5 sm:gap-4 lg:grid-cols-9 lg:gap-5">
            {GROWTH_BADGES.map((b, i) => (
              <div key={b.elem} className="flex flex-col items-center">
                <div
                  className="relative flex size-[84px] items-center justify-center rounded-3xl text-[26px] font-extrabold text-white shadow-[0_10px_30px_rgba(0,0,0,.35)]"
                  style={{ background: b.color }}
                >
                  {b.elem}
                  <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-white text-[12px] font-extrabold text-navy">
                    {i + 1}
                  </span>
                </div>
                <div className="mt-3 text-center text-[14px] leading-tight font-bold text-[#BFEFFF]">{b.lab}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · 多入口路径 */}
      <section className={show(7)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#101C52)]" />
        <div className="relative flex h-full flex-col justify-center px-6 sm:px-10 lg:px-24">
          <h2 className="text-[32px] font-extrabold tracking-[2px] sm:text-[44px] lg:text-[52px] lg:tracking-[3px]">
            多入口 · <em className="not-italic text-cyan">殊途同归</em>
          </h2>
          <div className="mt-8 space-y-5 sm:mt-12 sm:space-y-8">
            {GROWTH_ENTRIES.map((e, i) => (
              <div key={e.key} className="flex items-center gap-6">
                <span
                  className="rounded-2xl px-4 py-3 text-[16px] font-extrabold text-white sm:px-6 sm:py-4 sm:text-[22px] lg:text-[24px]"
                  style={{ background: i === 0 ? "#FF7A45" : "#A79BFF" }}
                >
                  {e.key}
                </span>
                <span className="text-[20px] text-cyan sm:text-[26px] lg:text-[28px]">→</span>
                <span className="text-[17px] font-bold text-white sm:text-[22px] lg:text-[26px]">{e.path}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 w-fit rounded-2xl bg-cyan/10 px-5 py-3 text-[16px] font-extrabold text-cyan sm:mt-12 sm:px-8 sm:py-4 sm:text-[22px] lg:text-[24px]">
            {GROWTH_ENTRIES_NOTE}
          </div>
        </div>
      </section>

      {/* 9 · 结尾 CTA */}
      <section className={show(8)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/img/mkt-hero-poster.png"
          alt=""
          loading={idx === 8 ? "eager" : "lazy"}
          fetchPriority={idx === 8 ? "high" : "low"}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,14,40,.92),rgba(8,14,40,.4))]" />
        <div className="relative flex h-full items-center px-6 sm:px-10 lg:px-24">
          <div>
            <h2 className="text-[36px] leading-tight font-extrabold tracking-[2px] sm:text-[52px] lg:text-[64px] lg:tracking-[4px]">
              体验课<em className="not-italic text-cyan">免费预约</em>
            </h2>
            <div className="mt-4 text-[15px] leading-relaxed text-[#BFEFFF] sm:mt-6 sm:text-[21px] lg:text-[26px]">
              3 节体验课 · AI 绘本生成 / 数字人 / 计算机视觉
              <br />
              让孩子先点亮第一项能力认证
            </div>
            <div className="mt-6 inline-flex rounded-2xl bg-orange px-5 py-3 text-[18px] font-extrabold tracking-[2px] text-white sm:mt-10 sm:px-8 sm:py-4 sm:text-[25px] lg:px-10 lg:py-5 lg:text-[30px] lg:tracking-[3px]">
              扫码或到店咨询 · 0 元预约
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/img/mascot/cube-pair-standard.png"
            alt=""
            loading={idx === 8 ? "eager" : "lazy"}
            fetchPriority={idx === 8 ? "high" : "low"}
            className="ml-auto hidden w-[280px] drop-shadow-[0_20px_50px_rgba(0,229,255,.3)] md:block lg:w-[380px]"
          />
        </div>
      </section>

      {/* 页码指示器 */}
      <div
        aria-live="polite"
        className="fixed right-8 bottom-6 rounded-full bg-white/10 px-5 py-2 text-[15px] font-extrabold tracking-[3px] text-white/85 backdrop-blur-sm"
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
