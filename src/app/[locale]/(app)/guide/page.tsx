import { useTranslations } from "next-intl";
import type { Metadata } from "next";
import { Spotlight } from "@/components/aceternity/spotlight";

export const metadata: Metadata = { title: "使用指南" };
import { Printer, MonitorPlay, Settings2 } from "lucide-react";

interface PrintItem { icon: string; title: string; points: string[] }
interface StepBlock { title: string; steps: string[] }

/** 编号步骤条 */
function Steps({ steps, color }: { steps: string[]; color: string }) {
  return (
    <ol className="mt-3 space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold text-white"
            style={{ background: color }}
          >
            {i + 1}
          </span>
          <span className="text-[13px] leading-relaxed text-subtext">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  const t = useTranslations("guide");
  const print = t.raw("print") as {
    title: string; titleEm: string; sub: string;
    items: PrintItem[]; commonTitle: string; common: string[];
  };
  const player = t.raw("player") as { title: string; titleEm: string; sub: string; blocks: StepBlock[] };
  const ops = t.raw("ops") as { title: string; titleEm: string; sub: string; blocks: StepBlock[] };

  const anchors = [
    { href: "#print", label: t("anchorPrint"), icon: Printer, color: "#FF7A45" },
    { href: "#player", label: t("anchorPlayer"), icon: MonitorPlay, color: "#5E9BFF" },
    { href: "#ops", label: t("anchorOps"), icon: Settings2, color: "#A79BFF" },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title1")}
            <em className="not-italic text-cyan">{t("title2")}</em>
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-[#9FB3E8]">{t("sub")}</div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-cyan/20 hover:text-cyan"
              >
                <a.icon className="size-4" style={{ color: a.color }} />
                {a.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 板块一 · 印刷指南 */}
      <section id="print" className="mx-auto max-w-[1200px] scroll-mt-24 px-7 pt-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {print.title} <em className="not-italic text-cyan-print">{print.titleEm}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-subtext">{print.sub}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {print.items.map((it) => (
            <div key={it.title} className="flex gap-4 rounded-2xl bg-card p-5 shadow-card">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#F0F5FC]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/icons/${it.icon}.png`} alt="" className="size-6.5" />
              </span>
              <div>
                <h3 className="text-[15px] font-extrabold text-navy">{it.title}</h3>
                <ul className="mt-1.5 space-y-1">
                  {it.points.map((p) => (
                    <li key={p} className="text-[12.5px] leading-relaxed text-subtext">
                      · {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[#FFE0CC] bg-[#FFF7F2] p-5">
          <div className="text-[14px] font-extrabold text-orange">{print.commonTitle}</div>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1.5">
            {print.common.map((c) => (
              <span key={c} className="text-[12.5px] font-bold text-navy">
                · {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 板块二 · 播放指南 */}
      <section id="player" className="mx-auto max-w-[1200px] scroll-mt-24 px-7 pt-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {player.title} <em className="not-italic text-cyan-print">{player.titleEm}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-subtext">{player.sub}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {player.blocks.map((b, i) => (
            <div key={b.title} className="rounded-2xl bg-card p-6 shadow-card" style={{ borderTop: `4px solid ${["#5E9BFF", "#FF7A45", "#A79BFF"][i]}` }}>
              <h3 className="text-[16px] font-extrabold text-navy">{b.title}</h3>
              <Steps steps={b.steps} color={["#5E9BFF", "#FF7A45", "#A79BFF"][i]} />
            </div>
          ))}
        </div>
      </section>

      {/* 板块三 · 更新指南 */}
      <section id="ops" className="mx-auto max-w-[1200px] scroll-mt-24 px-7 py-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {ops.title} <em className="not-italic text-cyan-print">{ops.titleEm}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-subtext">{ops.sub}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ops.blocks.map((b) => (
            <div key={b.title} className="rounded-2xl bg-card p-6 shadow-card">
              <h3 className="text-[16px] font-extrabold text-navy">{b.title}</h3>
              <Steps steps={b.steps} color="#1B2A6B" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
