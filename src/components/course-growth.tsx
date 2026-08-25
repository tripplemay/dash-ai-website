import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { COURSE_CAPABILITIES, LEARNING_LOOP } from "@/lib/data";

export function CourseGrowth() {
  const t = useTranslations("course");

  return (
    <section className="w-full px-7 py-8.5">
      <h2 className="text-[26px] font-extrabold tracking-[2px]">
        {t("growthTitle")} <em className="not-italic text-coral-700">{t("growthEm")}</em>
      </h2>
      <div className="mt-1.5 text-[13.5px] text-muted-foreground">{t("growthSub")}</div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COURSE_CAPABILITIES.map((capability) => (
          <div
            key={capability.name}
            className="rounded-lg border border-neutral-200 bg-card p-5 shadow-card"
            style={{ borderTop: `4px solid ${capability.color}` }}
          >
            <h3 className="text-[17px] font-extrabold" style={{ color: capability.color }}>
              {capability.name}
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{capability.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-neutral-200 bg-card p-5 shadow-card sm:p-6">
        <h3 className="text-[16px] font-extrabold">{t("loopTitle")}</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">{t("loopSub")}</p>
        <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">
          {LEARNING_LOOP.map((step, index) => (
            <li key={step} className="relative flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-3 sm:block sm:text-center">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-[12px] font-extrabold text-white">
                {index + 1}
              </span>
              <span className="text-[12.5px] font-extrabold text-indigo-800">{step}</span>
              {index < LEARNING_LOOP.length - 1 && (
                <span aria-hidden="true" className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-[16px] font-extrabold text-coral-700 sm:block">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {["理解 AI 的原理与边界", "用 AI 做出真实作品", "安全负责地使用 AI"].map((item) => (
            <div key={item} className="flex items-start gap-2 text-[12.5px] font-bold text-indigo-800">
              <Check className="mt-0.5 size-3.5 shrink-0 text-coral-700" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
