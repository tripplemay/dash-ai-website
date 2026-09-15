"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft, ArrowRight, AudioLines, Award, BookOpen, Braces,
  ChartNoAxesCombined, Check, CircleHelp, Drone, Expand,
  Eye, Film, Globe2, Layers3, MessageCircle, Palette, Pause, Play,
  ShieldCheck, Smartphone, Sparkles, Target, Undo2, Users, X,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  CAMPUS_SCREEN_ASSETS, CAMPUS_SCREEN_CONTACT, CAMPUS_SCREEN_SLIDES,
  screenIndexFromSearch, type CampusScreenSlide, type ScreenIcon, type ScreenItem,
} from "@/lib/campus-screen";
import s from "./campus-screen.module.css";

const ICONS: Record<ScreenIcon, LucideIcon> = {
  spark: Sparkles, brush: Palette, voice: AudioLines, code: Braces, film: Film,
  drone: Drone, app: Smartphone, data: ChartNoAxesCombined, target: Target,
  prompt: MessageCircle, iterate: Undo2, show: Eye, teacher: Users,
  shield: ShieldCheck, globe: Globe2, award: Award, book: BookOpen, message: MessageCircle,
};

function Icon({ name, size = 34 }: { name: ScreenIcon; size?: number }) {
  const Component = ICONS[name];
  return <Component size={size} strokeWidth={1.55} aria-hidden="true" />;
}

function Artwork({ src, className = "" }: { src: string; className?: string }) {
  // Text and diagrams stay in HTML/SVG; these are decorative concept images.
  return <img src={src} alt="" width={1672} height={941} decoding="async" draggable={false} className={className} />; // eslint-disable-line @next/next/no-img-element
}

function HeroContent() {
  return <>
    <div className={s.heroCoordinates} aria-hidden="true">
      <span>IMAGINATION</span><i /><span>CREATION</span><i /><span>POSSIBILITY</span>
    </div>
    <div className={s.heroMetrics}>
      {[["5–16", "岁青少年"], ["9", "大课程领域"], ["400+", "体系总课时"], ["4", "核心能力"]].map(([value, label]) => (
        <div key={label}><strong>{value}</strong><span>{label}</span></div>
      ))}
    </div>
    <div className={s.heroAbilities}>
      <span>创意表达</span><span>计算构建</span><span>证据推理</span><span>责任判断</span>
    </div>
  </>;
}

function DomainsContent({ slide }: { slide: CampusScreenSlide }) {
  const entry = slide.items.find((item) => item.domainGroup === "entry");
  const groups = [
    { id: "creative", title: "创作方向", english: "CREATE", color: "#FFB48A" },
    { id: "engineering", title: "工程方向", english: "BUILD", color: "#73E0DE" },
    { id: "literacy", title: "素养方向", english: "UNDERSTAND", color: "#68CFFF" },
  ] as const;
  return <div className={s.domainsContent}>
    {entry && <article className={s.domainEntry} data-domain-entry>
      <span className={s.eyebrow}>兴趣入口</span>
      <div className={s.domainCore}><Icon name={entry.icon} size={56} /></div>
      <h2>{entry.title}</h2><p>{entry.description}</p>
      <span className={s.domainEntryCount}><b>1</b> 个课程域</span>
      <span className={s.domainEntryHint}>由体验，发现自己的方向</span>
    </article>}
    <svg className={s.domainBranches} viewBox="0 0 88 510" aria-hidden="true"><path d="M0 255H40 M40 79V431 M40 79H88 M40 255H88 M40 431H88" /><circle cx="40" cy="255" r="5" /></svg>
    <div className={s.domainGroups}>
      {groups.map((group) => {
        const items = slide.items.filter((item) => item.domainGroup === group.id);
        return <section className={s.domainBand} data-domain-group={group.id} style={{ "--domain-color": group.color } as CSSProperties} key={group.id}>
          <div className={s.domainGroupHeading}><span>{group.english}</span><h2>{group.title}</h2><p><b>{items.length}</b> 个课程域</p></div>
          <div className={s.domainCells} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => <article className={s.domainCell} key={item.title} data-course-domain>
              <Icon name={item.icon} size={33} /><div><h3>{item.title}</h3><p>{item.description}</p></div>
              {group.id === "literacy" && <div className={s.domainLiteracyNotes}><span>智能原理</span><i /><span>技术边界</span><i /><span>责任判断</span></div>}
            </article>)}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

function PathsContent({ slide }: { slide: CampusScreenSlide }) {
  return <div className={s.pathsContent}>
    <div className={s.entryCards}>{slide.items.map((item, index) => (
      <article className={s.entryCard} key={item.title}>
        <div className={s.entryNumber}>0{index + 1}</div>
        <div><span className={s.eyebrow}>{item.label}</span><h2>{item.title}</h2><p>{item.description}</p></div>
        <Icon name={item.icon} size={44} />
      </article>
    ))}</div>
    <div className={s.directionMap}>
      <div className={s.mapOrigin}><span>找到兴趣</span><strong>选择起点</strong></div>
      <svg className={s.branchLines} viewBox="0 0 660 180" aria-hidden="true">
        <path d="M330 0V55 M110 105V55H550V105 M330 55V105" />
        <circle cx="330" cy="55" r="5" />
      </svg>
      <div className={s.directionNodes}>
        {[["brush", "创作表达"], ["code", "工程探索"], ["data", "应用研究"]].map(([icon, label]) => (
          <div key={label}><Icon name={icon as ScreenIcon} /><strong>{label}</strong></div>
        ))}
      </div>
    </div>
  </div>;
}

function SchoolContent({ slide }: { slide: CampusScreenSlide }) {
  const coordinates = slide.id === "primary"
    ? ["想象", "创作", "表达"]
    : slide.id === "middle" ? ["拆解", "构建", "测试"] : ["定义", "实现", "论证"];
  return <div className={s.schoolContent}>
    <div className={s.courseRows} data-count={slide.items.length}>
      {slide.items.map((item, index) => (
        <article className={s.courseRow} key={item.title}>
          <div className={s.courseIndex}>0{index + 1}</div>
          <div className={s.courseIcon}><Icon name={item.icon} size={36} /></div>
          <div className={s.courseCopy}><h2>{item.title}</h2><p>{item.description}</p></div>
          <span className={s.courseLabel}>{item.label}</span>
        </article>
      ))}
    </div>
    <div className={s.projectCoordinates}>
      <span className={s.eyebrow}>能力在项目中形成</span>
      <div>{coordinates.map((label, index) => (
        <span key={label}><b>0{index + 1}</b><strong>{label}</strong>{index < 2 && <ArrowRight size={30} aria-hidden="true" />}</span>
      ))}</div>
      <span className={s.conceptLabel}>AI 概念视觉 · 非学员实拍</span>
    </div>
  </div>;
}

function PictureCards({ slide }: { slide: CampusScreenSlide }) {
  const trial = slide.kind === "trial";
  return <div className={s.pictureCards}>
    {slide.items.map((item, index) => (
      <article className={s.pictureCard} key={item.title}>
        <div className={s.cardImage}>
          <Artwork src={item.image || slide.image} />
          <span className={s.cardNumber}>0{index + 1}</span>
          <span className={s.imageLabel}>{trial ? "体验主题示意" : "课程成果示意"}</span>
          <div className={s.imageReticle} aria-hidden="true" />
        </div>
        <div className={s.pictureCardCopy}>
          <div className={s.cardHeading}><Icon name={item.icon} /><h2>{item.title}</h2></div>
          <p>{item.description}</p>
          <div className={s.cardTrail}>{item.label}<ArrowRight size={25} aria-hidden="true" /></div>
        </div>
      </article>
    ))}
  </div>;
}

function ProcessContent({ slide }: { slide: CampusScreenSlide }) {
  return <div className={s.processContent}>
    <div className={s.processIntro}>
      <div><span className={s.eyebrow}>PROJECT-BASED LEARNING</span><strong>从问题出发，在迭代中学会</strong></div>
      <span className={s.conceptLabel}>AI 课堂概念视觉 · 非学员实拍</span>
    </div>
    <div className={s.processFlow}>
      {slide.items.map((item, index) => (
        <article className={s.processStep} key={item.title}>
          <div className={s.stepTop}><span className={s.stepCircle}>0{index + 1}</span>{index < 4 && <ArrowRight size={29} aria-hidden="true" />}</div>
          <Icon name={item.icon} size={37} /><h2>{item.title}</h2><p>{item.description}</p>
          <span className={s.evidenceTag}>{item.label}</span>
        </article>
      ))}
    </div>
    <div className={s.iterationLoop}><Undo2 size={23} aria-hidden="true" /><span>发现问题，回到前一步再改进</span><i /></div>
  </div>;
}

function EvidenceDiagram({ index }: { index: number }) {
  if (index === 0) return <div className={s.versionDiagram} aria-hidden="true">
    <div><svg viewBox="0 0 100 80"><path d="M15 48H88L70 68H34Z M46 44V8L79 42Z" /></svg><span>初版</span></div>
    <ArrowRight size={29} />
    <div><svg viewBox="0 0 100 80"><path d="M15 48H88L70 68H34Z M46 44V8L79 42Z M39 43V20L21 43Z M10 74Q20 68 30 74T50 74T70 74T90 74" /></svg><span>完善版</span></div>
  </div>;
  if (index === 1) return <div className={s.reasonDiagram} aria-hidden="true">
    <div><CircleHelp size={30} /><span>发现问题</span></div><ArrowRight size={23} /><div><Layers3 size={30} /><span>比较方案</span></div><ArrowRight size={23} /><div><Check size={30} /><span>解释选择</span></div>
  </div>;
  return <div className={s.feedbackDiagram} aria-hidden="true">
    <div><Check size={24} /><span>已掌握</span><i /><i /></div>
    <div><ArrowRight size={24} /><span>下一步</span><i /></div>
  </div>;
}

function GrowthContent({ slide }: { slide: CampusScreenSlide }) {
  return <div className={s.evidenceCards}>{slide.items.map((item, index) => (
    <article className={s.evidenceCard} key={item.title}>
      <div className={s.evidenceHeader}><span className={s.eyebrow}>{item.label}</span><Icon name={item.icon} /></div>
      <EvidenceDiagram index={index} />
      <span className={s.miniRule} /><h2>{item.title}</h2><p>{item.description}</p>
    </article>
  ))}</div>;
}

function QualityContent({ slide }: { slide: CampusScreenSlide }) {
  return <div className={s.qualityContent}>
    <div className={s.qualityColumns}>{slide.items.map((item, index) => (
      <article className={s.qualityColumn} key={item.title}>
        <div className={s.qualityTop}><span>0{index + 1}</span><Icon name={item.icon} size={49} /></div>
        <span className={s.eyebrow}>{item.label}</span><h2>{item.title}</h2>
        <div className={s.certificationName}>{item.certificationName}</div>
        <p>{item.description}</p>
        <div className={s.qualityBasis}>{index === 2 ? "产品维度" : "教师维度"}<span />{index === 2 ? "学习体验" : index === 0 ? "专业基础" : "教学实践"}</div>
      </article>
    ))}</div>
  </div>;
}

function OpportunitiesContent({ slide }: { slide: CampusScreenSlide }) {
  return <div className={s.opportunitiesContent}>
    <div className={s.opportunityOrigin}><Layers3 size={54} aria-hidden="true" /><span>从课堂出发</span><strong>项目作品</strong><small>兴趣 · 能力 · 准备</small></div>
    <svg className={s.opportunityLines} viewBox="0 0 280 450" aria-hidden="true"><path d="M0 225H100 M100 64V388 M100 64H275 M100 225H275 M100 388H275" /><circle cx="100" cy="225" r="6" /></svg>
    <div className={s.opportunityRows}>{slide.items.map((item) => (
      <article className={s.opportunityRow} key={item.title}>
        <div className={s.courseIcon}><Icon name={item.icon} size={36} /></div>
        <div><span className={s.eyebrow}>{item.label}</span><h2>{item.title}</h2><p>{item.description}</p></div>
      </article>
    ))}</div>
  </div>;
}

function CompetitionsContent({ slide }: { slide: CampusScreenSlide }) {
  const groups = [
    { id: "domestic", title: "国内赛事", english: "DOMESTIC", color: "#68CFFF", icon: "award" },
    { id: "international", title: "国际赛事", english: "INTERNATIONAL", color: "#73E0DE", icon: "globe" },
  ] as const;
  return <div className={s.competitionsContent}>
    {groups.map((group) => {
      const items = slide.items.filter((item) => item.competitionGroup === group.id);
      return <section className={s.competitionGroup} data-competition-group={group.id} style={{ "--competition-color": group.color } as CSSProperties} key={group.id}>
        <div className={s.competitionHeading}>
          <Icon name={group.icon} size={31} /><h2>{group.title}</h2><span>{group.english}</span>
          <b>{String(items.length).padStart(2, "0")} <small>项精选</small></b>
        </div>
        <div className={s.competitionList}>
          {items.map((item) => <article className={s.competitionRow} data-competition key={item.title}>
            <div className={s.competitionIcon}><Icon name={item.icon} size={29} /></div>
            <div className={s.competitionCopy}><h3>{item.title}</h3><p><span>{item.label}</span><i aria-hidden="true" />{item.description}</p></div>
          </article>)}
        </div>
      </section>;
    })}
  </div>;
}

function ContactContent({ slide }: { slide: CampusScreenSlide }) {
  return <div className={s.contactContent}>
    <div className={s.contactSteps}>{slide.items.map((item: ScreenItem, index) => (
      <div key={item.title}><span className={s.contactStepNumber}>0{index + 1}</span><div><h2>{item.title}</h2><p>{item.description}</p></div><Icon name={item.icon} /></div>
    ))}</div>
    <div className={s.contactAction}>
      {CAMPUS_SCREEN_CONTACT.qrCodeSrc && <img src={CAMPUS_SCREEN_CONTACT.qrCodeSrc} width={144} height={144} alt="本校咨询二维码" className={s.realQr} /> /* eslint-disable-line @next/next/no-img-element */}
      <div><span className={s.eyebrow}>{CAMPUS_SCREEN_CONTACT.campusName || "欢迎到访芯坐标"}</span><strong>{CAMPUS_SCREEN_CONTACT.qrCodeSrc ? "扫码了解体验安排" : "向前台了解体验安排"}</strong>{CAMPUS_SCREEN_CONTACT.phone && <span>{CAMPUS_SCREEN_CONTACT.phone}</span>}</div>
      <ArrowRight size={42} aria-hidden="true" />
    </div>
  </div>;
}

function SlideContent({ slide }: { slide: CampusScreenSlide }) {
  switch (slide.kind) {
    case "hero": return <HeroContent />;
    case "domains": return <DomainsContent slide={slide} />;
    case "paths": return <PathsContent slide={slide} />;
    case "school": return <SchoolContent slide={slide} />;
    case "works": case "trial": return <PictureCards slide={slide} />;
    case "process": return <ProcessContent slide={slide} />;
    case "growth": return <GrowthContent slide={slide} />;
    case "quality": return <QualityContent slide={slide} />;
    case "opportunities": return <OpportunitiesContent slide={slide} />;
    case "competitions": return <CompetitionsContent slide={slide} />;
    case "contact": return <ContactContent slide={slide} />;
  }
}

function ScreenSlide({ slide, index, active, running }: { slide: CampusScreenSlide; index: number; active: boolean; running: boolean }) {
  return <article className={s.slide} data-slide-id={slide.id} data-kind={slide.kind} data-active={active} aria-hidden={!active} style={{ "--accent": slide.accent } as CSSProperties}>
    <Artwork src={slide.image} className={s.backdrop} />
    <div className={s.scrim} /><div className={s.coordinateGrid} aria-hidden="true" />
    <header className={s.header}>
      <BrandLogo variant="horizontal-reverse" width={225} height={90} priority />
      <div className={s.headerSection}><i /><span>{slide.section}</span><span className={s.headerDivider} /><span className={s.headerEnglish}>CORECOORD / LEARNING COORDINATES</span></div>
    </header>
    <div className={s.heading}>
      <div className={s.headingKicker}><span>{String(index + 1).padStart(2, "0")}</span><i />{slide.english}</div>
      <h1 data-long={slide.title.length > 20}>{slide.title}</h1><p>{slide.subtitle}</p>
    </div>
    <SlideContent slide={slide} />
    <footer className={s.footer}><span className={s.footerLead}><span />{slide.takeaway}</span><span className={s.pageCount}>{String(index + 1).padStart(2, "0")}<i />{CAMPUS_SCREEN_SLIDES.length}</span></footer>
    {active && <div className={s.progress} aria-hidden="true">{CAMPUS_SCREEN_SLIDES.map((entry, n) => <span key={entry.id} data-complete={n < index}>{n === index && <i key={`${index}-${running}`} data-running={running} style={{ animationDuration: `${slide.duration}ms` }} />}</span>)}</div>}
  </article>;
}

function ScreenPlayer() {
  const params = useSearchParams();
  const router = useRouter();
  const [index, setIndex] = useState(() => screenIndexFromSearch(params.toString()));
  const [playing, setPlaying] = useState(() => params.get("paused") !== "1");
  const [visible, setVisible] = useState(true);
  const [scale, setScale] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const hideHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<number | null>(null);
  const total = CAMPUS_SCREEN_SLIDES.length;
  const running = playing && visible;

  const syncUrl = useCallback((next: number, paused: boolean) => {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(next + 1));
    if (paused) url.searchParams.set("paused", "1"); else url.searchParams.delete("paused");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const goTo = useCallback((next: number, pause = true) => {
    const clamped = ((next % total) + total) % total;
    setIndex(clamped);
    if (pause) setPlaying(false);
    syncUrl(clamped, pause || !playing);
  }, [playing, syncUrl, total]);

  const togglePlaying = useCallback(() => {
    setPlaying(!playing);
    syncUrl(index, playing);
  }, [index, playing, syncUrl]);

  const showHud = useCallback(() => {
    setHudVisible(true);
    if (hideHudTimer.current) clearTimeout(hideHudTimer.current);
    hideHudTimer.current = setTimeout(() => setHudVisible(false), 2600);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewport.current?.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError("当前浏览器不支持全屏，可使用浏览器的全屏菜单。");
    }
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.focus({ preventScroll: true });
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080));
    });
    observer.observe(element);
    const onVisibility = () => setVisible(!document.hidden);
    const visibilityFrame = requestAnimationFrame(onVisibility);
    const onPopState = () => {
      setIndex(screenIndexFromSearch(window.location.search));
      setPlaying(new URLSearchParams(window.location.search).get("paused") !== "1");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("popstate", onPopState);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(visibilityFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("popstate", onPopState);
      if (hideHudTimer.current) clearTimeout(hideHudTimer.current);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => goTo(index + 1, false), CAMPUS_SCREEN_SLIDES[index].duration);
    return () => clearTimeout(timer);
  }, [goTo, index, running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, [contenteditable=true]"))) return;
      if (event.key === "Tab") {
        showHud();
        const buttons = viewport.current?.querySelectorAll<HTMLButtonElement>("nav button");
        if (buttons?.length) {
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === viewport.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          }
        }
        return;
      }
      if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest("button")) return;
      switch (event.key) {
        case "ArrowRight": case "PageDown": event.preventDefault(); goTo(index + 1); break;
        case "ArrowLeft": case "PageUp": event.preventDefault(); goTo(index - 1); break;
        case "Home": event.preventDefault(); goTo(0); break;
        case "End": event.preventDefault(); goTo(total - 1); break;
        case " ": event.preventDefault(); togglePlaying(); break;
        case "f": case "F": event.preventDefault(); void toggleFullscreen(); break;
        case "Escape": if (!document.fullscreenElement) router.push("/presentations"); break;
        default: return;
      }
      showHud();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, router, showHud, toggleFullscreen, togglePlaying, total]);

  const nextImage = CAMPUS_SCREEN_SLIDES[(index + 2) % total].image;
  return <div ref={viewport} className={s.viewport} tabIndex={-1} data-testid="campus-screen" data-playing={playing} role="dialog" aria-modal="true" aria-label={`芯坐标校区大屏，共 ${total} 页`} onPointerMove={showHud} onFocusCapture={(event) => { if (event.target !== event.currentTarget) showHud(); }}
    onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; showHud(); }}
    onTouchEnd={(event) => {
      const from = touchStart.current;
      touchStart.current = null;
      if (from !== null && Math.abs(event.changedTouches[0].clientX - from) > 60) goTo(index + (event.changedTouches[0].clientX < from ? 1 : -1));
    }}>
    <link rel="preload" as="image" href={nextImage} />
    <link rel="preload" as="image" href={`${CAMPUS_SCREEN_ASSETS}/hero.webp`} />
    <div className={s.stage} data-testid="campus-screen-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
      {CAMPUS_SCREEN_SLIDES.map((slide, n) => {
        const distance = Math.abs(n - index);
        return distance <= 1 || distance === total - 1 ? <ScreenSlide key={slide.id} slide={slide} index={n} active={n === index} running={running} /> : null;
      })}
    </div>
    <nav className={s.hud} data-visible={hudVisible} data-testid="campus-screen-hud" aria-label="大屏播放控制">
      <button onClick={() => goTo(index - 1)} aria-label="上一页"><ArrowLeft size={19} /></button>
      <button onClick={togglePlaying} aria-label={playing ? "暂停播放" : "自动播放"}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
      <span className={s.hudCount}>{String(index + 1).padStart(2, "0")} / {total}</span>
      <button onClick={() => goTo(index + 1)} aria-label="下一页"><ArrowRight size={19} /></button>
      <span className={s.hudSeparator} />
      <button onClick={() => void toggleFullscreen()} aria-label="切换全屏"><Expand size={19} /></button>
      <button onClick={() => router.push("/presentations")} aria-label="退出大屏"><X size={19} /></button>
      <span className={s.hudHint}>方向键翻页 · 空格播放</span>
    </nav>
    {fullscreenError && <div className={s.fullscreenNotice} role="status" onClick={() => setFullscreenError("")}>{fullscreenError}</div>}
  </div>;
}

export default function CampusScreen() {
  return <Suspense fallback={<div className={s.viewport} />}><ScreenPlayer /></Suspense>;
}
