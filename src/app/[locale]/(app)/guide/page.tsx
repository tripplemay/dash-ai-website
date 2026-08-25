import { useTranslations } from "next-intl";
import type { Metadata } from "next";
import { CoordinateField } from "@/components/coordinate-field";
import { stageOnAccent } from "@/lib/brand";

export const metadata: Metadata = { title: "使用指南" };
import {
  BookOpen,
  CalendarDays,
  Image as ImageIcon,
  MessageCircle,
  MonitorPlay,
  Printer,
  Settings2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";

interface PrintItem { icon: string; title: string; points: string[] }
interface StepBlock { title: string; steps: string[] }

const PRINT_ICONS = {
  image: ImageIcon,
  users: Users,
  upload: Upload,
  calendar: CalendarDays,
  trophy: Trophy,
  book: BookOpen,
  chat: MessageCircle,
} as const;

/** 编号步骤条 */
function Steps({ steps, color }: { steps: string[]; color: string }) {
  return (
    <ol className="mt-3 space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold"
            style={{ background: color, color: stageOnAccent(color) }}
          >
            {i + 1}
          </span>
          <span className="text-[13px] leading-relaxed text-neutral-600">{s}</span>
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
    { href: "#print", label: t("anchorPrint"), icon: Printer, color: "#F16C3E" },
    { href: "#player", label: t("anchorPlayer"), icon: MonitorPlay, color: "#1B78C5" },
    { href: "#ops", label: t("anchorOps"), icon: Settings2, color: "#40549C" },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-reverse-background pt-11 pb-8.5 text-white">
        <CoordinateField className="absolute top-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
        <div className="relative z-10 w-full px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title1")}
            <em className="not-italic text-coral-300">{t("title2")}</em>
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-neutral-300">{t("sub")}</div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-4 py-2 text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-coral-500/20 hover:text-coral-300"
              >
                <a.icon className="size-4" style={{ color: a.color }} />
                {a.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 板块一 · 印刷指南 */}
      <section id="print" className="w-full scroll-mt-24 px-7 pt-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {print.title} <em className="not-italic text-coral-700">{print.titleEm}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-neutral-600">{print.sub}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {print.items.map((it) => (
            <div key={it.title} className="flex gap-4 rounded-lg border border-neutral-200 bg-card p-5 shadow-card">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-indigo-50">
                {(() => {
                  const Icon = PRINT_ICONS[it.icon as keyof typeof PRINT_ICONS] ?? ImageIcon;
                  return <Icon aria-hidden="true" className="size-6 text-indigo-700" />;
                })()}
              </span>
              <div>
                <h3 className="text-[15px] font-extrabold text-indigo-800">{it.title}</h3>
                <ul className="mt-1.5 space-y-1">
                  {it.points.map((p) => (
                    <li key={p} className="text-[12.5px] leading-relaxed text-neutral-600">
                      · {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-5">
          <div className="text-[14px] font-extrabold text-orange-700">{print.commonTitle}</div>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1.5">
            {print.common.map((c) => (
              <span key={c} className="text-[12.5px] font-bold text-indigo-800">
                · {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 板块二 · 播放指南 */}
      <section id="player" className="w-full scroll-mt-24 px-7 pt-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {player.title} <em className="not-italic text-coral-700">{player.titleEm}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-neutral-600">{player.sub}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {player.blocks.map((b, i) => (
            <div key={b.title} className="rounded-lg border border-neutral-200 bg-card p-6 shadow-card" style={{ borderTop: `4px solid ${["#1B78C5", "#F16C3E", "#40549C"][i]}` }}>
              <h3 className="text-[16px] font-extrabold text-indigo-800">{b.title}</h3>
              <Steps steps={b.steps} color={["#1B78C5", "#F16C3E", "#40549C"][i]} />
            </div>
          ))}
        </div>
      </section>

      {/* 板块三 · 更新指南 */}
      <section id="ops" className="w-full scroll-mt-24 px-7 py-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">
          {ops.title} <em className="not-italic text-coral-700">{ops.titleEm}</em>
        </h2>
        <div className="mt-1.5 text-[13.5px] text-neutral-600">{ops.sub}</div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ops.blocks.map((b) => (
            <div key={b.title} className="rounded-lg border border-neutral-200 bg-card p-6 shadow-card">
              <h3 className="text-[16px] font-extrabold text-indigo-800">{b.title}</h3>
              <Steps steps={b.steps} color="#22367B" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
