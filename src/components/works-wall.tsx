import { useTranslations } from "next-intl";
import { WORK_SLOTS } from "@/lib/data";

/** 学员作品墙（占位：结课后替换为真实作品） */
export function WorksWall() {
  const t = useTranslations("course");

  return (
    <section className="mx-auto max-w-[1200px] px-7 pt-2 pb-4">
      <h2 className="text-[26px] font-extrabold tracking-[2px]">
        {t("worksTitle")} <em className="not-italic text-cyan-print">{t("worksEm")}</em>
      </h2>
      <div className="mt-1.5 text-[13.5px] text-subtext">{t("worksSub")}</div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WORK_SLOTS.map((w) => (
          <div
            key={w.title}
            className="group relative flex flex-col items-center overflow-hidden rounded-2xl border-2 border-dashed border-[#C9D6F2] bg-white/70 px-6 py-10 text-center transition-colors hover:border-cyan-print/60"
          >
            {/* 水印式标注 */}
            <span className="pointer-events-none absolute top-4 -right-9 rotate-45 bg-[#EEF4FE] px-10 py-1 text-[10px] font-extrabold tracking-[2px] text-subtext">
              {t("worksWatermark")}
            </span>
            <span className="flex size-16 items-center justify-center rounded-2xl bg-[#F0F5FC]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/assets/icons/${w.icon}.png`} alt="" width={36} height={36} loading="lazy" decoding="async" className="size-9 opacity-80" />
            </span>
            <h3 className="mt-4 text-[15px] font-extrabold text-navy">{w.title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-subtext">{w.desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] text-subtext">{t("worksNote")}</p>
    </section>
  );
}
