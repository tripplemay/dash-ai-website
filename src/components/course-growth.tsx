import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import {
  GROWTH_LAYERS,
  GROWTH_BADGES,
  GROWTH_TITLES,
  GROWTH_POINTS,
  GROWTH_PROFILE,
  GROWTH_ENTRIES,
  GROWTH_ENTRIES_NOTE,
} from "@/lib/data";

/** 五维能力雷达图（纯 SVG 示意） */
function RadarChart({ dims, values, note }: { dims: string[]; values: number[]; note: string }) {
  const cx = 130, cy = 118, R = 82;
  const pt = (i: number, ratio: number) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio];
  };
  const ring = (ratio: number) =>
    dims.map((_, i) => pt(i, ratio).join(",")).join(" ");
  const valuePoly = dims.map((_, i) => pt(i, values[i] / 100).join(",")).join(" ");

  return (
    <div className="relative">
      <svg viewBox="0 0 260 240" className="w-full max-w-[300px]">
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon key={r} points={ring(r)} fill="none" stroke="#D6E2F8" strokeWidth="1" />
        ))}
        {dims.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#D6E2F8" strokeWidth="1" />;
        })}
        <polygon points={valuePoly} fill="rgba(0,184,217,.18)" stroke="#00B8D9" strokeWidth="2" />
        {dims.map((_, i) => {
          const [x, y] = pt(i, values[i] / 100);
          return <circle key={i} cx={x} cy={y} r="3.5" fill="#00B8D9" />;
        })}
        {dims.map((d, i) => {
          const [x, y] = pt(i, 1.24);
          return (
            <text
              key={d}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="800"
              fill="#1B2A6B"
            >
              {d}
            </text>
          );
        })}
      </svg>
      <span className="absolute top-1 right-1 rounded-md bg-[#FFF1E8] px-2 py-0.5 text-[10px] font-extrabold text-orange">
        {note}
      </span>
    </div>
  );
}

export function CourseGrowth() {
  const t = useTranslations("course");

  return (
    <section className="mx-auto max-w-[1200px] px-7 py-8.5">
      <h2 className="text-[26px] font-extrabold tracking-[2px]">
        {t("growthTitle")} <em className="not-italic text-cyan-print">{t("growthEm")}</em>
      </h2>
      <div className="mt-1.5 text-[13.5px] text-subtext">{t("growthSub")}</div>

      {/* 四层阶梯（递进版式） */}
      <div className="relative mt-7">
        <div className="pointer-events-none absolute inset-x-8 bottom-6 hidden h-px bg-[linear-gradient(90deg,#00B8D9,#5E9BFF,#A79BFF,#FF7A45)] opacity-40 md:block" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          {GROWTH_LAYERS.map((l, i) => (
            <div key={l.level} className="stair-item" style={{ "--i": i } as React.CSSProperties}>
              <div
                className="relative flex h-full flex-col rounded-2xl bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                style={{ borderTop: `4px solid ${l.color}` }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[26px] font-extrabold tracking-widest" style={{ color: l.color }}>
                    {l.level}
                  </span>
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: l.color }}>
                    LEVEL
                  </span>
                </div>
                <h3 className="mt-2 text-[17px] font-extrabold">{l.title}</h3>
                <div className="mt-1 text-[12px] font-bold" style={{ color: l.color }}>{l.tagline}</div>
                <ul className="mt-3 space-y-1.5">
                  {l.points.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-subtext">
                      <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: l.color }} />
                      {p}
                    </li>
                  ))}
                </ul>
                {i < GROWTH_LAYERS.length - 1 && (
                  <div className="absolute top-1/2 -right-4 hidden -translate-y-1/2 text-[18px] font-extrabold text-[#C9D6F2] md:block">
                    →
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 积分细则 + 徽章序列 */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="rounded-2xl bg-card p-6 shadow-card lg:col-span-2">
          <h3 className="text-[16px] font-extrabold">{t("pointsTitle")}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {GROWTH_POINTS.rules.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-xl bg-[#F0F5FC] px-3.5 py-2.5">
                <span className="text-[12.5px] font-bold text-navy">{r.label}</span>
                <span className="text-[15px] font-extrabold text-cyan-print">{r.value}</span>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {GROWTH_POINTS.principles.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-subtext">
                <Check className="mt-0.5 size-3.5 shrink-0 text-cyan-print" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card lg:col-span-3">
          <h3 className="text-[16px] font-extrabold">{t("badgesTitle")}</h3>
          <div className="mt-1 text-[12px] text-subtext">{t("badgesSub")}</div>
          <div className="relative mt-5">
            <div className="pointer-events-none absolute top-[26px] right-6 left-6 hidden h-0.5 bg-[#E4EAF7] sm:block" />
            <div className="grid grid-cols-3 gap-y-5 sm:grid-cols-9 sm:gap-0">
              {GROWTH_BADGES.map((b, i) => (
                <div key={b.elem} className="relative flex flex-col items-center text-center">
                  <div
                    className="relative z-10 flex size-[52px] items-center justify-center rounded-2xl text-[17px] font-extrabold text-white shadow-card"
                    style={{ background: b.color }}
                  >
                    {b.elem}
                    <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-navy text-[9px] font-extrabold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] leading-tight font-bold text-navy">{b.lab}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 三轨称号 */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        {GROWTH_TITLES.map((g) => (
          <div key={g.name} className="rounded-2xl bg-card p-6 shadow-card" style={{ borderLeft: `4px solid ${g.color}` }}>
            <div className="flex items-baseline gap-2">
              <h3 className="text-[17px] font-extrabold">{g.name}</h3>
              <span className="text-[12px] font-extrabold" style={{ color: g.color }}>{g.alias}</span>
            </div>
            <div className="mt-1.5 text-[12px] font-bold text-subtext">{g.condition}</div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-subtext">{g.proof}</p>
          </div>
        ))}
      </div>

      {/* 成长档案 + 多入口 */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl bg-card p-6 shadow-card sm:flex-row sm:items-center sm:gap-6">
          <div className="shrink-0">
            <RadarChart dims={GROWTH_PROFILE.radarDims} values={GROWTH_PROFILE.radarSample} note={t("radarNote")} />
          </div>
          <div>
            <h3 className="text-[16px] font-extrabold">{t("profileTitle")}</h3>
            <div className="mt-1 text-[12px] text-subtext">{t("profileSub")}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {GROWTH_PROFILE.reportItems.map((r) => (
                <span key={r} className="rounded-lg border border-[#E0EAF8] bg-[#F0F5FC] px-2.5 py-1 text-[11px] font-bold text-[#3D5A80]">
                  {r}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-subtext">{GROWTH_PROFILE.physical}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h3 className="text-[16px] font-extrabold">{t("entriesTitle")}</h3>
          <div className="mt-4 space-y-3">
            {GROWTH_ENTRIES.map((e, i) => (
              <div key={e.key} className="flex items-center gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold text-white"
                  style={{ background: i === 0 ? "#FF7A45" : "#A79BFF" }}
                >
                  {i === 0 ? "小" : "大"}
                </span>
                <div>
                  <div className="text-[13px] font-extrabold text-navy">
                    {e.key} <span className="mx-1 text-[#C9D6F2]">·</span>
                    <span className="text-cyan-print">{e.path}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-subtext">{e.note}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#F0F5FC] px-4 py-3 text-[12.5px] font-bold text-navy">
            {GROWTH_ENTRIES_NOTE}
          </div>
        </div>
      </div>
    </section>
  );
}
