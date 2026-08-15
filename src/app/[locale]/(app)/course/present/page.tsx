"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { LABS, GROWTH_LAYERS, GROWTH_BADGES, GROWTH_ENTRIES, GROWTH_ENTRIES_NOTE } from "@/lib/data";
import { cn } from "@/lib/utils";

const TOTAL = 9;

function PresentDeck() {
  const router = useRouter();
  const sp = useSearchParams();
  const raw = Number(sp.get("slide"));
  const initial = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), TOTAL) : 1;
  const [idx, setIdx] = useState(initial - 1); // 0-based
  const [cursorOn, setCursorOn] = useState(true);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((i: number) => {
    setIdx(((i % TOTAL) + TOTAL) % TOTAL);
  }, []);
  const next = useCallback(() => setIdx((v) => (v + 1) % TOTAL), []);
  const prev = useCallback(() => setIdx((v) => (v - 1 + TOTAL) % TOTAL), []);
  const exit = useCallback(() => router.push("/course"), [router]);

  const wake = useCallback(() => {
    setCursorOn(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setCursorOn(false), 3000);
  }, []);

  useEffect(() => {
    wake();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight" || e.code === "Space") {
        e.preventDefault();
        next();
      }
      if (e.code === "ArrowLeft") prev();
      if (e.code === "Escape") exit();
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
    i === idx ? "opacity-100" : "pointer-events-none opacity-0"
  );

  return (
    <div className={cn("fixed inset-0 z-[60] bg-midnight text-white", !cursorOn && "cursor-none")}>
      {/* 1 · 品牌定位 */}
      <section className={show(0)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/img/cover-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,14,40,.9),rgba(8,14,40,.4))]" />
        <div className="relative flex h-full flex-col justify-center px-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/logo/DASH-mark-dark_1024.png" alt="" className="logo-rounded size-20 object-cover" />
          <h1 className="mt-8 text-[72px] leading-tight font-extrabold tracking-[4px]">
            DASH <em className="not-italic text-cyan">AI</em> 实验室
          </h1>
          <div className="mt-6 text-[28px] font-bold tracking-[6px] text-[#BFEFFF]">少儿 AI 素养课程 · 合作伙伴课程介绍</div>
          <div className="mt-12 inline-flex w-fit rounded-2xl border border-cyan/40 bg-cyan/10 px-8 py-4 text-[32px] font-extrabold tracking-[4px] text-cyan">
            兴趣是入口，能力是出口
          </div>
          <div className="absolute bottom-10 left-24 text-sm tracking-widest text-[#8FA3DC]">← → 翻页 · ESC 退出</div>
        </div>
      </section>

      {/* 2 · 数字总览 */}
      <section className={show(1)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#1B2A6B)]" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <div className="text-[22px] font-extrabold tracking-[8px] text-[#9FB3E8]">课程体系总览</div>
          <div className="mt-14 flex items-end gap-24">
            {[
              { n: "9", u: "大能力实验室" },
              { n: "132", u: "课时" },
              { n: "5–16", u: "岁覆盖" },
            ].map((s) => (
              <div key={s.u} className="text-center">
                <div className="text-[120px] leading-none font-extrabold text-cyan">{s.n}</div>
                <div className="mt-4 text-[26px] font-bold tracking-[3px] text-white">{s.u}</div>
              </div>
            ))}
          </div>
          <div className="mt-14 text-[24px] text-[#BFEFFF]">AIGC 创作 · 编程工程 · 智能硬件 三大方向</div>
        </div>
      </section>

      {/* 3–5 · 三大实验室 */}
      {LABS.map((lab, i) => (
        <section key={lab.en} className={show(2 + i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/assets/ext/实验室海报-${i + 1}.png`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,14,40,.92),rgba(8,14,40,.25))]" />
          <div className="relative flex h-full flex-col justify-end px-24 pb-24">
            <span
              className="w-fit rounded-xl px-5 py-2 text-[20px] font-extrabold tracking-[4px] text-white"
              style={{ background: lab.color }}
            >
              {lab.en}
            </span>
            <h2 className="mt-6 text-[64px] font-extrabold tracking-[4px]">
              {lab.name}
              <span className="ml-6 align-middle text-[26px] font-bold text-[#BFEFFF]">{lab.hours}</span>
            </h2>
            <div className="mt-3 text-[24px] text-[#BFEFFF]">{lab.desc}</div>
            <div className="mt-8 flex flex-wrap gap-4">
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
        <div className="relative flex h-full flex-col justify-center px-24">
          <div className="text-[22px] font-extrabold tracking-[8px] text-[#9FB3E8]">成长体系</div>
          <h2 className="mt-4 text-[52px] font-extrabold tracking-[3px]">
            能力认证<em className="not-italic text-cyan">阶梯</em>
          </h2>
          <div className="mt-14 flex items-stretch gap-6">
            {GROWTH_LAYERS.map((l, i) => (
              <div key={l.level} className="flex flex-1 items-center gap-6">
                <div
                  className="flex-1 rounded-2xl bg-white/8 p-6 backdrop-blur-sm"
                  style={{ borderTop: `4px solid ${l.color}`, transform: `translateY(${(3 - i) * -18}px)` }}
                >
                  <div className="text-[30px] font-extrabold" style={{ color: l.color }}>{l.level}</div>
                  <div className="mt-2 text-[26px] font-extrabold">{l.title}</div>
                  <div className="mt-2 text-[15px] leading-relaxed text-[#BFEFFF]">{l.tagline}</div>
                </div>
                {i < GROWTH_LAYERS.length - 1 && <div className="text-[28px] text-cyan/60">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · 九枚认证徽章 */}
      <section className={show(6)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1232,#1B2A6B)]" />
        <div className="relative flex h-full flex-col justify-center px-24">
          <h2 className="text-[52px] font-extrabold tracking-[3px]">
            九枚<em className="not-italic text-cyan">实验室认证徽章</em>
          </h2>
          <div className="mt-3 text-[22px] text-[#BFEFFF]">每通过一座实验室的项目评估，即点亮一项能力认证</div>
          <div className="mt-12 grid grid-cols-9 gap-5">
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
        <div className="relative flex h-full flex-col justify-center px-24">
          <h2 className="text-[52px] font-extrabold tracking-[3px]">
            多入口 · <em className="not-italic text-cyan">殊途同归</em>
          </h2>
          <div className="mt-12 space-y-8">
            {GROWTH_ENTRIES.map((e, i) => (
              <div key={e.key} className="flex items-center gap-6">
                <span
                  className="rounded-2xl px-6 py-4 text-[24px] font-extrabold text-white"
                  style={{ background: i === 0 ? "#FF7A45" : "#A79BFF" }}
                >
                  {e.key}
                </span>
                <span className="text-[28px] text-cyan">→</span>
                <span className="text-[26px] font-bold text-white">{e.path}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 w-fit rounded-2xl bg-cyan/10 px-8 py-4 text-[24px] font-extrabold text-cyan">
            {GROWTH_ENTRIES_NOTE}
          </div>
        </div>
      </section>

      {/* 9 · 结尾 CTA */}
      <section className={show(8)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/img/mkt-hero-poster.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,14,40,.92),rgba(8,14,40,.4))]" />
        <div className="relative flex h-full items-center px-24">
          <div>
            <h2 className="text-[64px] leading-tight font-extrabold tracking-[4px]">
              体验课<em className="not-italic text-cyan">免费预约</em>
            </h2>
            <div className="mt-6 text-[26px] leading-relaxed text-[#BFEFFF]">
              3 节体验课 · AI 绘本生成 / 数字人 / 计算机视觉
              <br />
              让孩子先点亮第一项能力认证
            </div>
            <div className="mt-10 inline-flex rounded-2xl bg-orange px-10 py-5 text-[30px] font-extrabold tracking-[3px] text-white">
              扫码或到店咨询 · 0 元预约
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/mascot/cube-pair-standard.png" alt="" className="ml-auto w-[380px] drop-shadow-[0_20px_50px_rgba(0,229,255,.3)]" />
        </div>
      </section>

      {/* 页码指示器 */}
      <div className="fixed right-8 bottom-6 rounded-full bg-white/10 px-5 py-2 text-[15px] font-extrabold tracking-[3px] text-white/85 backdrop-blur-sm">
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
