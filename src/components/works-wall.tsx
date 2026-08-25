import { useTranslations } from "next-intl";
import { WORK_SLOTS } from "@/lib/data";
import { AppWindow, BarChart3, BookOpen, Brush, ChartNoAxesCombined, Code2, Mic, Plane, ShieldCheck, Video } from "lucide-react";

const WORK_ICONS = {
  brush: Brush,
  mic: Mic,
  video: Video,
  app: AppWindow,
  drone: Plane,
  code: Code2,
  chart: ChartNoAxesCombined,
  shield: ShieldCheck,
  book: BookOpen,
  bars: BarChart3,
} as const;

/** 学员作品墙（占位：结课后替换为真实作品） */
export function WorksWall() {
  const t = useTranslations("course");

  return (
    <section className="w-full px-7 pt-2 pb-4">
      <h2 className="text-[26px] font-extrabold tracking-[2px]">
        {t("worksTitle")} <em className="not-italic text-coral-700">{t("worksEm")}</em>
      </h2>
      <div className="mt-1.5 text-[13.5px] text-muted-foreground">{t("worksSub")}</div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WORK_SLOTS.map((w) => (
          <div
            key={w.title}
            className="group relative flex flex-col items-center overflow-hidden rounded-lg border-2 border-dashed border-indigo-200 bg-white/70 px-6 py-10 text-center transition-colors hover:border-coral-500/60"
          >
            {/* 水印式标注 */}
            <span className="pointer-events-none absolute top-4 -right-9 rotate-45 bg-indigo-50 px-10 py-1 text-[10px] font-extrabold tracking-[2px] text-muted-foreground">
              {t("worksWatermark")}
            </span>
            <span className="flex size-16 items-center justify-center rounded-md bg-indigo-50">
              {(() => {
                const Icon = WORK_ICONS[w.icon as keyof typeof WORK_ICONS] ?? Brush;
                return <Icon aria-hidden="true" className="size-9 text-indigo-700" />;
              })()}
            </span>
            <h3 className="mt-4 text-[15px] font-extrabold text-indigo-800">{w.title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{w.desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] text-muted-foreground">{t("worksNote")}</p>
    </section>
  );
}
