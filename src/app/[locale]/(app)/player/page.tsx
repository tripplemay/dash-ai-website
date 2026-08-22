"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SLIDES, LABS, GROWTH_LAYERS, WORK_SLOTS, Lab } from "@/lib/data";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assets";
import { X } from "lucide-react";

const DUR = 8000;

function slideFromSearch(search: string, total: number): number {
  const raw = Number(new URLSearchParams(search).get("slide"));
  return Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), total) : 1;
}

/* ---------- content 型 slide（数据均引自 data.ts） ---------- */

function LabSlide({ lab, poster, active }: { lab: Lab; poster: string; active: boolean }) {
  return (
    <div className="absolute inset-0 bg-midnight">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        loading={active ? "eager" : "lazy"}
        fetchPriority={active ? "high" : "low"}
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,14,40,.92),rgba(8,14,40,.3))]" />
      <div className="relative flex h-full flex-col justify-end p-10 pb-24 lg:p-24 lg:pb-28">
        <span
          className="w-fit rounded-xl px-4 py-1.5 text-sm font-extrabold tracking-[4px] text-white lg:px-5 lg:py-2 lg:text-[20px]"
          style={{ background: lab.color }}
        >
          {lab.en}
        </span>
        <h2 className="mt-4 text-[38px] font-extrabold tracking-[3px] text-white lg:mt-6 lg:text-[64px] lg:tracking-[4px]">
          {lab.name}
          <span className="ml-4 align-middle text-[15px] font-bold text-[#BFEFFF] lg:ml-6 lg:text-[26px]">
            {lab.hours}
          </span>
        </h2>
        <div className="mt-2 text-[16px] text-[#BFEFFF] lg:mt-3 lg:text-[24px]">{lab.desc}</div>
        <div className="mt-5 flex flex-wrap gap-3 lg:mt-8 lg:gap-4">
          {lab.courses.map((c) => (
            <div key={c.name} className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm lg:px-6 lg:py-4">
              <span className="text-[17px] font-extrabold text-white lg:text-[24px]">{c.name}</span>
              <span className="ml-2.5 text-[12px] text-[#BFEFFF] lg:ml-3 lg:text-[16px]">
                {c.age} · {c.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GrowthSlide() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#101C52)]">
      <div className="relative flex h-full flex-col justify-center p-10 lg:px-24">
        <div className="text-[13px] font-extrabold tracking-[6px] text-[#9FB3E8] lg:text-[20px]">成长体系</div>
        <h2 className="mt-3 text-[32px] font-extrabold tracking-[3px] text-white lg:text-[52px]">
          能力认证<em className="not-italic text-cyan">阶梯</em>
        </h2>
        <div className="mt-8 flex flex-col gap-4 lg:mt-14 lg:flex-row lg:items-stretch lg:gap-6">
          {GROWTH_LAYERS.map((l, i) => (
            <div key={l.level} className="flex flex-1 items-center gap-4 lg:gap-6">
              <div
                className="flex-1 rounded-2xl bg-white/8 p-4 backdrop-blur-sm lg:p-6"
                style={{ borderTop: `4px solid ${l.color}` }}
              >
                <div className="text-[20px] font-extrabold lg:text-[30px]" style={{ color: l.color }}>
                  {l.level}
                </div>
                <div className="mt-1 text-[18px] font-extrabold text-white lg:mt-2 lg:text-[24px]">{l.title}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-[#BFEFFF] lg:mt-2 lg:text-[15px]">
                  {l.tagline}
                </div>
              </div>
              {i < GROWTH_LAYERS.length - 1 && (
                <div className="hidden text-[26px] text-cyan/60 lg:block">→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorksSlide() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#1B2A6B)]">
      <div className="relative flex h-full flex-col justify-center p-10 lg:px-24">
        <h2 className="text-[32px] font-extrabold tracking-[3px] text-white lg:text-[52px]">
          学员<em className="not-italic text-cyan">作品</em>
        </h2>
        <div className="mt-3 text-[15px] text-[#BFEFFF] lg:text-[22px]">
          每个阶段以真实作品结业——绘本 / 有声剧 / 小程序 / 无人机
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:mt-12 lg:grid-cols-4 lg:gap-6">
          {WORK_SLOTS.map((w) => (
            <div
              key={w.title}
              className="relative flex flex-col items-center overflow-hidden rounded-2xl border-2 border-dashed border-white/25 bg-white/5 px-4 py-8 text-center lg:py-12"
            >
              <span className="pointer-events-none absolute top-3 -right-8 rotate-45 bg-white/10 px-8 py-0.5 text-[9px] font-extrabold tracking-[2px] text-white/60">
                作品征集中
              </span>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#F0F5FC] lg:size-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/icons/${w.icon}.png`} alt="" loading="lazy" className="size-8 opacity-80 lg:size-9" />
              </span>
              <div className="mt-3 text-[15px] font-extrabold text-white lg:mt-4 lg:text-[20px]">{w.title}</div>
              <div className="mt-1 text-[11px] text-[#9FB3E8] lg:text-[13px]">{w.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CtaSlide({ active }: { active: boolean }) {
  return (
    <div className="absolute inset-0 bg-midnight">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/ext/mkt-hero-poster.png"
        alt=""
        loading={active ? "eager" : "lazy"}
        fetchPriority={active ? "high" : "low"}
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,14,40,.92),rgba(8,14,40,.45))]" />
      <div className="relative flex h-full flex-col items-start justify-center gap-8 p-10 lg:flex-row lg:items-center lg:gap-16 lg:px-24">
        <div>
          <h2 className="text-[36px] leading-tight font-extrabold tracking-[3px] text-white lg:text-[64px] lg:tracking-[4px]">
            体验课<em className="not-italic text-cyan">免费预约</em>
          </h2>
          <div className="mt-4 text-[15px] leading-relaxed text-[#BFEFFF] lg:mt-6 lg:text-[24px]">
            3 节体验课 · AI 绘本生成 / 数字人 / 计算机视觉
            <br />
            让孩子先获得第一项能力认证
          </div>
          <div className="mt-6 inline-flex rounded-2xl bg-orange px-7 py-3.5 text-[18px] font-extrabold tracking-[3px] text-white lg:mt-10 lg:px-10 lg:py-5 lg:text-[28px]">
            扫码预约 · 0 元体验
          </div>
        </div>
        {/* 二维码占位框 */}
        <div className="flex flex-col items-center">
          <div className="relative flex size-[160px] items-center justify-center rounded-2xl border-2 border-dashed border-cyan/50 bg-white/5 lg:size-[220px]">
            <span className="absolute top-2 left-2 size-5 border-t-2 border-l-2 border-cyan" />
            <span className="absolute top-2 right-2 size-5 border-t-2 border-r-2 border-cyan" />
            <span className="absolute bottom-2 left-2 size-5 border-b-2 border-l-2 border-cyan" />
            <span className="absolute right-2 bottom-2 size-5 border-r-2 border-b-2 border-cyan" />
            <span className="text-[13px] font-bold tracking-[3px] text-[#9FB3E8] lg:text-[15px]">二维码占位</span>
          </div>
          <div className="mt-3 text-[12px] tracking-[2px] text-[#9FB3E8] lg:text-[13px]">校区预约二维码</div>
        </div>
      </div>
    </div>
  );
}

function ContentSlide({ contentKey, active }: { contentKey: string; active: boolean }) {
  if (contentKey.startsWith("lab-")) {
    const i = Number(contentKey.split("-")[1]);
    return (
      <LabSlide
        lab={LABS[i]}
        poster={assetUrl(`/assets/ext/实验室海报-${i + 1}.png`)}
        active={active}
      />
    );
  }
  if (contentKey === "growth") return <GrowthSlide />;
  if (contentKey === "works") return <WorksSlide />;
  return <CtaSlide active={active} />;
}

/* ---------- 播放器 ---------- */

function PlayerDeck() {
  const t = useTranslations("player");
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const search = sp.toString();
  const initial = slideFromSearch(search, SLIDES.length);
  const [idx, setIdx] = useState(initial - 1); // 0-based
  const [playing, setPlaying] = useState(true);
  const [awake, setAwake] = useState(true);
  const idxRef = useRef(initial - 1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const playingRef = useRef(playing);

  const exitLabel = locale === "zh" ? "退出大屏播放" : "Exit screen player";
  const prevLabel = locale === "zh" ? "上一页" : "Previous slide";
  const nextLabel = locale === "zh" ? "下一页" : "Next slide";

  const updateSlideUrl = useCallback((slide: number, mode: "push" | "replace") => {
    const params = new URLSearchParams(window.location.search);
    params.set("slide", String(slide));
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    if (mode === "push") {
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
  }, []);

  const go = useCallback(
    (i: number, mode: "push" | "replace" = "push") => {
      const next = ((i % SLIDES.length) + SLIDES.length) % SLIDES.length;
      idxRef.current = next;
      setIdx(next);
      updateSlideUrl(next + 1, mode);
    },
    [updateSlideUrl]
  );

  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (playingRef.current) {
      timer.current = setInterval(() => go(idxRef.current + 1, "replace"), DUR);
    }
  }, [go]);

  const next = useCallback(() => {
    go(idxRef.current + 1);
    restart();
  }, [go, restart]);

  const prev = useCallback(() => {
    go(idxRef.current - 1);
    restart();
  }, [go, restart]);

  const toggle = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const wake = useCallback(() => {
    setAwake(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setAwake(false), 3000);
  }, []);

  const exit = useCallback(() => router.push("/workspace"), [router]);

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

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Native history updates are integrated with the Next router; this restores
  // the visible slide when the user presses browser Back/Forward.
  useEffect(() => {
    const nextSlide = slideFromSearch(search, SLIDES.length) - 1;
    if (nextSlide !== idxRef.current) {
      idxRef.current = nextSlide;
      setIdx(nextSlide);
    }
  }, [search]);

  useEffect(() => {
    restart();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [restart, playing]);

  useEffect(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setAwake(false), 3000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.code === "ArrowRight") next();
      if (e.code === "ArrowLeft") prev();
      if (e.code === "Escape") {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", onKey);
      if (idle.current) clearTimeout(idle.current);
    };
  }, [exit, next, prev, toggle, wake]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={exit}
        aria-label={exitLabel}
        title={exitLabel}
        className="fixed top-4 left-4 z-20 inline-flex size-10 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <X className="size-5" />
      </button>

      {/* 轮播舞台 */}
      <div className="absolute inset-0">
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={cn(
              "absolute inset-0 transition-opacity duration-900 ease-in-out",
              i === idx ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            {s.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.img}
                alt={s.cap}
                loading={i === idx ? "eager" : "lazy"}
                fetchPriority={i === idx ? "high" : "low"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <ContentSlide contentKey={s.content} active={i === idx} />
            )}
          </div>
        ))}
      </div>

      {/* 指示点 */}
      <div
        className={cn(
          "fixed top-1/2 right-5 flex -translate-y-1/2 flex-col gap-2 transition-opacity duration-500",
          !awake && "pointer-events-none opacity-0"
        )}
      >
        {SLIDES.map((s, i) => (
          <button
            type="button"
            key={i}
            onClick={() => {
              go(i);
              restart();
            }}
            aria-label={s.cap}
            className={cn(
              "size-2 rounded-full bg-white/30",
              i === idx && "bg-cyan shadow-[0_0_8px_rgba(0,229,255,.8)]"
            )}
          />
        ))}
      </div>

      {/* HUD */}
      <div
        className={cn(
          "fixed right-0 bottom-0 left-0 flex items-center gap-3.5 bg-[linear-gradient(0deg,rgba(8,14,40,.85),transparent)] px-5.5 py-3.5 transition-opacity duration-500",
          !awake && "pointer-events-none opacity-0"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/img/logo/DASH-mark-dark_1024.png"
          alt="logo"
          className="logo-rounded hidden h-[30px] w-[30px] object-cover sm:block"
        />
        <div className="hidden text-sm font-extrabold tracking-[2px] text-white sm:block">
          DASH <em className="not-italic text-cyan">AI</em>
        </div>
        <div className="ml-1.5 hidden min-w-0 flex-1 truncate text-[12.5px] tracking-wide text-[#BFEFFF] md:block">
          {SLIDES[idx].cap}
        </div>
        <div className="flex-1" />
        <div className="text-[12.5px] font-bold tracking-[2px] text-[#BFEFFF] tabular-nums">
          {idx + 1} / {SLIDES.length}
        </div>
        <button
          type="button"
          onClick={prev}
          aria-label={prevLabel}
          className="rounded-[9px] border border-white/25 bg-white/12 px-2 py-1.5 text-xs tracking-wider text-white sm:px-3.5"
        >
          {t("prev")}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="rounded-[9px] border border-white/25 bg-white/12 px-2 py-1.5 text-xs tracking-wider text-white sm:px-3.5"
        >
          {playing ? t("pause") : t("play")}
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={nextLabel}
          className="rounded-[9px] border border-white/25 bg-white/12 px-2 py-1.5 text-xs tracking-wider text-white sm:px-3.5"
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense>
      <PlayerDeck />
    </Suspense>
  );
}
