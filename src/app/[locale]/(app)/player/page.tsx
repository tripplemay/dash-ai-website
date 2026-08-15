"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SLIDES } from "@/lib/data";
import { cn } from "@/lib/utils";

const DUR = 8000;

export default function PlayerPage() {
  const t = useTranslations("player");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [awake, setAwake] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const go = useCallback((i: number) => {
    setIdx(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (playingRef.current) {
      timer.current = setInterval(() => setIdx((v) => (v + 1) % SLIDES.length), DUR);
    }
  }, []);

  const next = useCallback(() => {
    setIdx((v) => (v + 1) % SLIDES.length);
    restart();
  }, [restart]);

  const prev = useCallback(() => {
    setIdx((v) => (v - 1 + SLIDES.length) % SLIDES.length);
    restart();
  }, [restart]);

  const toggle = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const wake = useCallback(() => {
    setAwake(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setAwake(false), 3000);
  }, []);

  useEffect(() => {
    restart();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [restart, playing]);

  useEffect(() => {
    wake();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.code === "ArrowRight") next();
      if (e.code === "ArrowLeft") prev();
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", onKey);
      if (idle.current) clearTimeout(idle.current);
    };
  }, [wake, next, prev, toggle]);

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* 轮播舞台 */}
      <div className="absolute inset-0">
        {SLIDES.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.img}
            src={s.img}
            alt={s.cap}
            className={cn(
              "absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-900 ease-in-out",
              i === idx && "opacity-100"
            )}
          />
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
            key={s.img}
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
        <img src="/assets/img/logo/DASH-mark-dark_1024.png" alt="logo" className="logo-rounded h-[30px] w-[30px] object-cover" />
        <div className="text-sm font-extrabold tracking-[2px] text-white">
          DASH <em className="not-italic text-cyan">AI</em>
        </div>
        <div className="ml-1.5 text-[12.5px] tracking-wide text-[#BFEFFF]">{SLIDES[idx].cap}</div>
        <div className="flex-1" />
        <button
          onClick={prev}
          className="rounded-[9px] border border-white/25 bg-white/12 px-3.5 py-1.5 text-xs tracking-wider text-white"
        >
          {t("prev")}
        </button>
        <button
          onClick={toggle}
          className="rounded-[9px] border border-white/25 bg-white/12 px-3.5 py-1.5 text-xs tracking-wider text-white"
        >
          {playing ? t("pause") : t("play")}
        </button>
        <button
          onClick={next}
          className="rounded-[9px] border border-white/25 bg-white/12 px-3.5 py-1.5 text-xs tracking-wider text-white"
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
