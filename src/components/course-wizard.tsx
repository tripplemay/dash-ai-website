"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleHelp,
  CodeXml,
  Download,
  MonitorPlay,
  Palette,
  RotateCcw,
  Rocket,
  Sprout,
  Wrench,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  LAB_SUMMARIES,
  TEMPLATE_FALLBACK,
  WizardAge,
  WizardInterest,
  WizardLevel,
  WizardTemplate,
  matchTemplate,
  needsLevel,
  recommend,
} from "@/lib/wizard";

const AGES: WizardAge[] = ["a1", "a2", "a3", "a4"];
const INTERESTS: { key: WizardInterest; icon: typeof Palette }[] = [
  { key: "create", icon: Palette },
  { key: "code", icon: CodeXml },
  { key: "hardware", icon: Wrench },
  { key: "unsure", icon: CircleHelp },
];
const LEVELS: { key: WizardLevel; icon: typeof Sprout }[] = [
  { key: "none", icon: Sprout },
  { key: "some", icon: BookOpen },
  { key: "pro", icon: Rocket },
];

export function CourseWizard({ templates }: { templates: WizardTemplate[] }) {
  const t = useTranslations("wizard");
  const ages = t.raw("ages") as string[];
  const interests = t.raw("interests") as string[];
  const levels = t.raw("levels") as string[];

  // 支持 ?age=a1&interest=create&level=none 直达结果（可分享/测试）
  const sp = useSearchParams();
  const [init] = useState(() => {
    const a = sp.get("age");
    const i = sp.get("interest");
    const l = sp.get("level");
    const age = AGES.includes(a as WizardAge) ? (a as WizardAge) : null;
    const interest =
      age && INTERESTS.some((x) => x.key === i) ? (i as WizardInterest) : null;
    const level =
      interest && LEVELS.some((x) => x.key === l) ? (l as WizardLevel) : null;
    const done = !!(age && interest && (level || !needsLevel(interest)));
    const step = done ? 0 : interest ? 2 : age ? 1 : 0;
    return { age, interest, level, done, step };
  });

  const [step, setStep] = useState(init.step); // 0=年龄 1=兴趣 2=基础
  const [age, setAge] = useState<WizardAge | null>(init.age);
  const [interest, setInterest] = useState<WizardInterest | null>(init.interest);
  const [level, setLevel] = useState<WizardLevel | null>(init.level);
  const [done, setDone] = useState(init.done);

  const syncUrl = (
    nextAge: WizardAge | null,
    nextInterest: WizardInterest | null,
    nextLevel: WizardLevel | null
  ) => {
    const params = new URLSearchParams();
    if (nextAge) params.set("age", nextAge);
    if (nextInterest) params.set("interest", nextInterest);
    if (nextLevel) params.set("level", nextLevel);
    const search = params.toString();
    window.history.pushState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  };

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const nextAge = AGES.includes(params.get("age") as WizardAge) ? (params.get("age") as WizardAge) : null;
      const nextInterest = nextAge && INTERESTS.some((x) => x.key === params.get("interest"))
        ? (params.get("interest") as WizardInterest)
        : null;
      const nextLevel = nextInterest && LEVELS.some((x) => x.key === params.get("level"))
        ? (params.get("level") as WizardLevel)
        : null;
      const nextDone = !!(nextAge && nextInterest && (nextLevel || !needsLevel(nextInterest)));
      setAge(nextAge);
      setInterest(nextInterest);
      setLevel(nextLevel);
      setDone(nextDone);
      setStep(nextDone ? 0 : nextInterest ? (needsLevel(nextInterest) ? 2 : 1) : nextAge ? 1 : 0);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const total = interest && !needsLevel(interest) ? 2 : 3;
  const result = done && age && interest ? recommend(age, interest, level ?? undefined) : null;

  const pickAge = (a: WizardAge) => {
    setAge(a);
    setInterest(null);
    setLevel(null);
    setDone(false);
    setStep(1);
    syncUrl(a, null, null);
  };
  const pickInterest = (i: WizardInterest) => {
    setInterest(i);
    setLevel(null);
    syncUrl(age, i, null);
    if (needsLevel(i)) setStep(2);
    else setDone(true);
  };
  const pickLevel = (l: WizardLevel) => {
    setLevel(l);
    setDone(true);
    syncUrl(age, interest, l);
  };
  const back = () => {
    if (done) {
      setDone(false);
      if (interest && needsLevel(interest)) {
        setLevel(null);
        setStep(2);
        syncUrl(age, interest, null);
      } else {
        setInterest(null);
        setStep(1);
        syncUrl(age, null, null);
      }
    } else {
      if (step === 2) {
        setLevel(null);
        setInterest(null);
        setStep(1);
        syncUrl(age, null, null);
      } else {
        setAge(null);
        setStep(0);
        syncUrl(null, null, null);
      }
    }
  };
  const restart = () => {
    setStep(0);
    setAge(null);
    setInterest(null);
    setLevel(null);
    setDone(false);
    syncUrl(null, null, null);
  };

  /** 问题卡大按钮（iPad 可点） */
  const optionCls = (selected: boolean) =>
    `flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 bg-card px-5 py-4 text-left text-[16px] font-extrabold text-navy transition-colors ${
      selected ? "border-cyan-print bg-[#F0F5FC]" : "border-[#E4EAF7] hover:border-[#B9CFEE] hover:bg-[#F8FBFF]"
    }`;

  return (
    <div className="mx-auto max-w-[860px] px-7 py-8.5">
      {/* 步骤条 + 返回 */}
      <div className="flex items-center gap-4">
        {!done && (
          <div className="flex flex-1 items-center gap-2">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step + 1 ? "bg-navy" : "bg-[#E4EAF7]"
                } ${i > total ? "opacity-25" : ""}`}
              />
            ))}
          </div>
        )}
        <div className="flex-1" />
        {(step > 0 || done) && (
          <button
            onClick={back}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#D6E2F8] bg-card px-4 py-2 text-[12.5px] font-extrabold text-navy transition-colors hover:border-cyan-print hover:text-cyan-print"
          >
            <ArrowLeft className="size-3.5" />
            {t("back")}
          </button>
        )}
      </div>
      {!done && (
        <div className="mt-2.5 text-[12.5px] font-bold tracking-wider text-subtext">
          {t("step", { n: step + 1, total })}
        </div>
      )}

      {/* 第 1 问：年龄段 */}
      {!done && step === 0 && (
        <section className="mt-6">
          <h2 className="text-[26px] font-extrabold tracking-[2px]">{t("q1")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {AGES.map((a, i) => (
              <button key={a} onClick={() => pickAge(a)} className={optionCls(age === a)}>
                {ages[i]}
                <ArrowRight className="ml-auto size-4 text-subtext" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 第 2 问：兴趣方向 */}
      {!done && step === 1 && (
        <section className="mt-6">
          <h2 className="text-[26px] font-extrabold tracking-[2px]">{t("q2")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {INTERESTS.map(({ key, icon: Icon }, i) => (
              <button key={key} onClick={() => pickInterest(key)} className={optionCls(interest === key)}>
                <Icon className="size-5 shrink-0 text-cyan-print" />
                {interests[i]}
                <ArrowRight className="ml-auto size-4 text-subtext" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 第 3 问：基础（仅编程/硬件方向） */}
      {!done && step === 2 && (
        <section className="mt-6">
          <h2 className="text-[26px] font-extrabold tracking-[2px]">{t("q3")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {LEVELS.map(({ key, icon: Icon }, i) => (
              <button key={key} onClick={() => pickLevel(key)} className={optionCls(level === key)}>
                <Icon className="size-5 shrink-0 text-cyan-print" />
                {levels[i]}
                <ArrowRight className="ml-auto size-4 text-subtext" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 结果页 */}
      {result && (
        <div className="mt-6">
          {/* 推荐起点卡 */}
          <div className="text-[12px] font-extrabold tracking-[3px] text-subtext">{t("resultTag")}</div>
          <div className="relative mt-2.5 overflow-hidden rounded-2xl border border-[#E4EAF7] bg-card p-[22px_24px]">
            <span
              className="absolute top-0 bottom-0 left-0 w-1.5"
              style={{ background: result.primary.lab.color }}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="rounded-[9px] px-3 py-1 text-[11px] font-extrabold tracking-widest text-white"
                style={{ background: result.primary.lab.color }}
              >
                {result.primary.lab.en}
              </span>
              <span className="text-[14px] font-extrabold text-navy">{result.primary.lab.name}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h2 className="text-[30px] font-extrabold tracking-[2px] text-navy">
                {result.primary.course.name}
              </h2>
              <span className="rounded-[9px] bg-[#EEF4FE] px-3 py-1 text-[12.5px] font-extrabold text-navy">
                {result.primary.course.age}
              </span>
              <span className="rounded-[9px] bg-navy px-3 py-1 text-[12.5px] font-extrabold text-white">
                {result.primary.course.count}
              </span>
            </div>
            <p className="mt-3.5 text-[14px] leading-[1.9] text-subtext">{result.reason}</p>
            {result.secondary && (
              <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl bg-[#F0F5FC] px-4 py-3">
                <span className="text-[12px] font-extrabold tracking-wider text-subtext">
                  {result.secondaryLabel}
                </span>
                <Link
                  href={`/courses/${result.secondary.course.slug}`}
                  className="rounded-[9px] px-3 py-1.5 text-[12.5px] font-extrabold text-white transition-opacity hover:opacity-85"
                  style={{ background: result.secondary.lab.color }}
                >
                  {result.secondary.course.name}
                </Link>
                <span className="text-[12px] text-subtext">
                  {result.secondary.course.age} · {result.secondary.course.count}
                </span>
              </div>
            )}
          </div>

          {/* 三大实验室速览（兴趣=还不确定） */}
          {result.showLabs && (
            <section className="mt-7">
              <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("labsTitle")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {LAB_SUMMARIES.map((l) => (
                  <Link
                    key={l.en}
                    href="/courses"
                    className="rounded-2xl border border-[#E4EAF7] bg-card p-4 transition-shadow hover:shadow-card"
                  >
                    <span
                      className="rounded-[8px] px-2.5 py-1 text-[10.5px] font-extrabold tracking-widest text-white"
                      style={{ background: l.color }}
                    >
                      {l.en}
                    </span>
                    <div className="mt-2.5 text-[15px] font-extrabold text-navy">{l.name}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-subtext">{l.desc}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 建议路径 */}
          <section className="mt-7">
            <h3 className="text-[16px] font-extrabold tracking-[2px]">{t("pathTitle")}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {result.path.map((p, i) => (
                <span key={p} className="flex items-center gap-2">
                  <span
                    className={`rounded-xl px-4 py-2.5 text-[13px] font-extrabold ${
                      i === result.path.length - 1
                        ? "text-white"
                        : "border border-[#E4EAF7] bg-card text-navy"
                    }`}
                    style={
                      i === result.path.length - 1 ? { background: result.primary.lab.color } : undefined
                    }
                  >
                    {p}
                  </span>
                  {i < result.path.length - 1 && <ArrowRight className="size-4 text-subtext" />}
                </span>
              ))}
            </div>
          </section>

          {/* 快捷动作 */}
          <section className="mt-8 flex flex-wrap gap-2.5 border-t-2 border-[#E4EAF7] pt-6">
            <Link
              href={`/courses/${result.primary.course.slug}`}
              className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-[13.5px] font-extrabold text-white transition-opacity hover:opacity-85"
              style={{ background: result.primary.lab.color }}
            >
              {t("actDetail")}
              <ArrowRight className="size-4" />
            </Link>
            {(() => {
              const hit = matchTemplate(templates, result.tplKey);
              const cls =
                "inline-flex items-center gap-2 rounded-[10px] border border-[#D6E2F8] bg-card px-5 py-3 text-[13.5px] font-extrabold text-navy transition-colors hover:border-cyan-print hover:text-cyan-print";
              return hit ? (
                <a href={hit} className={cls}>
                  <Download className="size-4" />
                  {t("actTemplate")}
                </a>
              ) : (
                <Link href={TEMPLATE_FALLBACK} className={cls}>
                  <Download className="size-4" />
                  {t("actTemplate")}
                </Link>
              );
            })()}
            <Link
              href="/presentations/course"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#D6E2F8] bg-card px-5 py-3 text-[13.5px] font-extrabold text-navy transition-colors hover:border-cyan-print hover:text-cyan-print"
            >
              <MonitorPlay className="size-4" />
              {t("actPresent")}
            </Link>
            <button
              onClick={restart}
              className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-[13.5px] font-extrabold text-subtext transition-colors hover:text-navy"
            >
              <RotateCcw className="size-4" />
              {t("actRestart")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
