import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CoordinateField } from "@/components/coordinate-field";
import { BrandLogo } from "@/components/brand-logo";
import { listRecentResources } from "@/lib/db";
import { BookOpen, Clock3, Image as ImageIcon, MonitorPlay } from "lucide-react";
import { LABS } from "@/lib/data";
import { stageOnAccent } from "@/lib/brand";

/** updated_at（UTC "YYYY-MM-DD HH:mm:ss"）→ 相对日期 */
function relDate(s: string, locale: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return locale === "zh" ? "今天" : "Today";
  if (days === 1) return locale === "zh" ? "昨天" : "Yesterday";
  if (days < 30) return locale === "zh" ? `${days} 天前` : `${days} days ago`;
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
}

const ROLES = [
  { key: "res", href: "/resources", icon: ImageIcon, iconBg: "bg-orange-50", go: "text-orange-700" },
  { key: "course", href: "/courses", icon: BookOpen, iconBg: "bg-indigo-50", go: "text-indigo-700" },
  { key: "player", href: "/presentations", icon: MonitorPlay, iconBg: "bg-coral-50", go: "text-coral-700" },
] as const;

const BRAND_PREVIEW_ROOT = "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/previews";
const LATEST = [
  { img: `${BRAND_PREVIEW_ROOT}/corecoord-presentation-cover-16x9.png`, key: "cover" },
  { img: `${BRAND_PREVIEW_ROOT}/corecoord-stage-palette.png`, key: "stages" },
  { img: `${BRAND_PREVIEW_ROOT}/corecoord-certificate-a4-landscape.png`, key: "certificate" },
  { img: `${BRAND_PREVIEW_ROOT}/corecoord-coordinate-field-light.png`, key: "field" },
];

const LAB_COPY: Record<string, { name: string; desc: string }> = {
  "CREATE LAB": { name: "Create Lab", desc: "AI creative fluency: image, voice, and motion" },
  "BUILD LAB": { name: "Build Lab", desc: "Engineering fluency: code, apps, and data" },
  "EXPLORE LAB": { name: "Explore Lab", desc: "Hardware and AI thinking: build, test, and understand" },
};

const LAB_PREVIEWS: Record<string, string> = {
  "CREATE LAB": `${BRAND_PREVIEW_ROOT}/corecoord-presentation-cover-16x9.png`,
  "BUILD LAB": `${BRAND_PREVIEW_ROOT}/corecoord-coordinate-field-light.png`,
  "EXPLORE LAB": `${BRAND_PREVIEW_ROOT}/corecoord-stage-palette.png`,
};

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const recent = listRecentResources(4);

  return (
    <>
      {/* Hero · CORECOORD coordinate field */}
      <section className="relative min-h-[350px] overflow-hidden bg-reverse-background">
        <CoordinateField
          priority
          className="absolute inset-y-0 right-0 h-full w-[62%] object-cover opacity-20 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-reverse-background/75" />
        <div className="relative z-10 mx-auto flex min-h-[350px] max-w-[1200px] flex-col justify-center px-7 py-12">
          <BrandLogo
            variant="mark-reverse"
            alt={locale === "zh" ? "芯坐标" : "CORECOORD"}
            width={48}
            height={48}
            className="size-12 sm:hidden"
            priority
          />
          <BrandLogo
            variant="horizontal-reverse"
            alt={locale === "zh" ? "芯坐标 CORECOORD" : "CORECOORD"}
            width={300}
            height={120}
            className="hidden h-auto w-[280px] sm:block"
            priority
          />
          <div className="mt-2 text-[13px] font-extrabold tracking-[3px] text-coral-300">{t("hero.kick")}</div>
          <h1 className="mt-3 text-[32px] leading-[1.35] font-extrabold tracking-[2px] text-white sm:text-[44px] lg:text-[52px]">
            {t("hero.title1")}
            <br />
            <em className="not-italic text-coral-300">{t("hero.title2")}</em>
          </h1>
          <p className="mt-3.5 text-base font-normal tracking-wide text-neutral-200">{t("hero.sub")}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/resources" className="rounded-md bg-coral-500 px-4 py-2.5 text-[13px] font-extrabold text-neutral-950 transition-colors hover:bg-coral-300">
              {t("roles.res.title")}
            </Link>
            <Link href="/courses" className="rounded-md border border-white/35 bg-white/10 px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-white/20">
              {t("roles.course.title")}
            </Link>
            <Link href="/presentations" className="rounded-md border border-white/35 bg-white/10 px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-white/20">
              {t("roles.player.title")}
            </Link>
          </div>
        </div>
      </section>

      {/* 最近更新资源提示条（悬浮在 hero 下缘） */}
      {recent.length > 0 && (
        <section className="relative z-20 mx-auto -mt-[28px] max-w-[1200px] px-7">
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-card px-6 py-4 shadow-card sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-2 text-[13px] font-extrabold tracking-wider text-indigo-800">
              <Clock3 className="size-4 text-coral-700" />
              {t("home.recentTitle")}
            </div>
            <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/resources/${r.id}`}
                  className="group flex min-w-0 items-baseline gap-2"
                >
                  <span className="truncate text-[13px] font-bold text-indigo-800 group-hover:text-coral-700">
                    {r.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-600">{relDate(r.updated_at, locale)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 三角色入口 */}
      <section className="relative z-20 mx-auto mt-6 max-w-[1200px] px-7">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Link
              key={r.key}
              href={r.href}
              className="group flex flex-col rounded-lg border border-neutral-200 bg-card p-[26px_24px] shadow-card transition-all duration-200 hover:-translate-y-1.5 hover:shadow-card-hover"
            >
              <div className={`mb-3.5 flex size-14 items-center justify-center rounded-md ${r.iconBg}`}>
                <r.icon aria-hidden="true" className="size-7" />
              </div>
              <h3 className="text-[19px] font-extrabold tracking-wide">{t(`roles.${r.key}.title`)}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-[1.75] text-neutral-600">{t(`roles.${r.key}.desc`)}</p>
              <div className={`mt-4 text-sm font-extrabold tracking-wider ${r.go} transition-transform group-hover:translate-x-1`}>
                {t("roles.enter")}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 三大实验室概览 */}
      <section className="mx-auto max-w-[1200px] px-7 py-8.5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[26px] font-extrabold tracking-[2px]">
              {t("home.labsTitle")}{" "}
              <em className="not-italic text-coral-700">{t("home.labsTitleEm")}</em>
            </h2>
            <div className="mt-1.5 text-[13.5px] text-neutral-600">{t("home.labsSub")}</div>
          </div>
          <Link href="/courses" className="text-sm font-extrabold text-coral-700 hover:underline">
            {t("home.viewAll")} →
          </Link>
        </div>
        <div className="mt-4.5 grid grid-cols-1 gap-5 md:grid-cols-3">
          {LABS.map((lab) => {
            const copy = locale === "en" ? LAB_COPY[lab.en] : undefined;
            const labName = copy?.name ?? lab.name;
            const labDesc = copy?.desc ?? lab.desc;
            return (
            <Link
              key={lab.en}
              href="/courses"
              className="group relative overflow-hidden rounded-lg border border-neutral-200 shadow-card transition-all duration-200 hover:-translate-y-1.5 hover:shadow-card-hover"
            >
              <div className="relative h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={LAB_PREVIEWS[lab.en] ?? `${BRAND_PREVIEW_ROOT}/corecoord-coordinate-field-light.png`}
                  alt={labName}
                  width={640}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-reverse-background/55" />
                <span
                  className="absolute top-3 left-3 rounded-md px-3 py-1.5 text-xs font-extrabold tracking-widest"
                  style={{ background: lab.color, color: stageOnAccent(lab.color) }}
                >
                  {lab.en}
                </span>
              </div>
              <div className="bg-card p-4.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-extrabold">{labName}</h3>
                  <span className="rounded-md bg-indigo-50 px-3 py-1 text-[13px] font-extrabold text-indigo-800">{lab.hours}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{labDesc}</p>
              </div>
            </Link>
            );
          })}
        </div>
      </section>

      {/* 最新资源 */}
      <section className="mx-auto max-w-[1200px] px-7 pt-2 pb-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">{t("home.latest")}</h2>
        <div className="mt-4.5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {LATEST.map((m) => (
            <Link
              key={m.key}
              href="/resources"
              className="overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.img}
                alt={t(`home.previewLabels.${m.key}`)}
                width={640}
                height={400}
                loading="lazy"
                decoding="async"
                className="aspect-[16/10] w-full object-cover"
              />
              <span className="block px-3 py-2.5 text-[13px] font-bold">{t(`home.previewLabels.${m.key}`)}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
