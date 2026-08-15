import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Spotlight } from "@/components/aceternity/spotlight";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { LABS } from "@/lib/data";

const ROLES = [
  { key: "res", href: "/resources", icon: "/assets/icons/image.png", iconBg: "#FFF1E8", go: "text-orange" },
  { key: "course", href: "/course", icon: "/assets/icons/book.png", iconBg: "#F0EDFF", go: "text-[#7A5CFF]" },
  { key: "player", href: "/player", icon: "/assets/icons/play.png", iconBg: "#E8F4FF", go: "text-[#2E7DFF]" },
] as const;

const LATEST = [
  { img: "/assets/ext/01-体验课招募海报-3x4.png", label: "体验课招募海报" },
  { img: "/assets/ext/实验室海报-1.png", label: "创想实验室海报" },
  { img: "/assets/ext/02-招生长图-9x16.png", label: "招生长图" },
  { img: "/assets/ext/mkt-rollup-main.png", label: "易拉宝主视觉" },
];

export default function HomePage() {
  const t = useTranslations();

  return (
    <>
      {/* Hero · 深空科技风 */}
      <section className="relative h-[520px] overflow-hidden bg-midnight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/img/mkt-hero-poster.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,14,40,.88),rgba(8,14,40,.35)_60%,rgba(8,14,40,.15))]" />
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#00E5FF" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-center px-7">
          <div className="text-[13px] font-extrabold tracking-[3px] text-[#FF9A6C]">{t("hero.kick")}</div>
          <h1 className="mt-3 text-[52px] leading-[1.35] font-extrabold tracking-[2px] text-white">
            {t("hero.title1")}
            <br />
            <em className="not-italic text-cyan">{t("hero.title2")}</em>
          </h1>
          <TextGenerateEffect
            words={t("hero.sub")}
            className="mt-3.5 text-base font-normal tracking-wide text-[#C7D6F5]"
            duration={0.3}
          />
        </div>
      </section>

      {/* 三角色入口 */}
      <section className="relative z-20 mx-auto -mt-[70px] max-w-[1200px] px-7">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Link
              key={r.key}
              href={r.href}
              className="group flex flex-col rounded-2xl bg-card p-[26px_24px] shadow-card transition-all duration-200 hover:-translate-y-1.5 hover:shadow-card-hover"
            >
              <div
                className="mb-3.5 flex size-14 items-center justify-center rounded-[14px]"
                style={{ background: r.iconBg }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.icon} alt="" className="size-[38px]" />
              </div>
              <h3 className="text-[19px] font-extrabold tracking-wide">{t(`roles.${r.key}.title`)}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-[1.75] text-subtext">{t(`roles.${r.key}.desc`)}</p>
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
              <em className="not-italic text-cyan-print">{t("home.labsTitleEm")}</em>
            </h2>
            <div className="mt-1.5 text-[13.5px] text-subtext">{t("home.labsSub")}</div>
          </div>
          <Link href="/course" className="text-sm font-extrabold text-cyan-print hover:underline">
            {t("home.viewAll")} →
          </Link>
        </div>
        <div className="mt-4.5 grid grid-cols-1 gap-5 md:grid-cols-3">
          {LABS.map((lab) => (
            <Link
              key={lab.en}
              href="/course"
              className="group relative overflow-hidden rounded-2xl shadow-card transition-all duration-200 hover:-translate-y-1.5 hover:shadow-card-hover"
            >
              <div className="relative h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/assets/ext/实验室海报-${lab.en === "CREATE LAB" ? 1 : lab.en === "BUILD LAB" ? 2 : 3}.png`}
                  alt={lab.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0 opacity-60"
                  style={{ background: `linear-gradient(180deg, transparent 20%, ${lab.color}CC)` }}
                />
                <span
                  className="absolute top-3 left-3 rounded-[10px] px-3 py-1.5 text-xs font-extrabold tracking-widest text-white"
                  style={{ background: lab.color }}
                >
                  {lab.en}
                </span>
              </div>
              <div className="bg-card p-4.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-extrabold">{lab.name}</h3>
                  <span className="rounded-[10px] bg-mist px-3 py-1 text-[13px] font-extrabold text-navy">{lab.hours}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-subtext">{lab.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 最新资源 */}
      <section className="mx-auto max-w-[1200px] px-7 pt-2 pb-8.5">
        <h2 className="text-[26px] font-extrabold tracking-[2px]">{t("home.latest")}</h2>
        <div className="mt-4.5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {LATEST.map((m) => (
            <Link
              key={m.label}
              href="/resources"
              className="overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.img} alt={m.label} className="aspect-[16/10] w-full object-cover" />
              <span className="block px-3 py-2.5 text-[13px] font-bold">{m.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
