import type { ImgHTMLAttributes, ReactNode } from "react";
import {
  CORECOORD_ASSET_ROOT,
  CORECOORD_COORDINATE_FIELD,
  CORECOORD_LEARNING_LOOP,
  CORECOORD_LOGO,
} from "@/lib/brand";
import styles from "./brand-manual-content.module.css";

const MANUAL_ASSET_ROOT = [CORECOORD_ASSET_ROOT, "vi-system-2026"].join("/");

function asset(path: string) {
  return [MANUAL_ASSET_ROOT, path].join("/");
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ManualImage({
  className,
  alt,
  loading = "lazy",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} loading={loading} className={joinClasses(styles.image, className)} />;
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className={styles.pageKicker}>{children}</p>;
}

function Rule() {
  return <div className={styles.rule} aria-hidden="true" />;
}

function FooterNote({ children }: { children: ReactNode }) {
  return <p className={styles.footerNote}>{children}</p>;
}

interface PageProps {
  id: string;
  chapter: string;
  labelledBy: string;
  number?: number;
  tone?: "soft" | "dark" | "coral" | "cover";
  children: ReactNode;
}

function Page({
  id,
  chapter,
  labelledBy,
  number,
  tone,
  children,
}: PageProps) {
  return (
    <section
      id={id}
      data-manual-page={number}
      data-manual-chapter={chapter}
      aria-labelledby={labelledBy}
      className={joinClasses(styles.page, tone && styles[tone])}
    >
      {children}
      {number ? <span className={styles.pageNumber}>{String(number).padStart(2, "0")}</span> : null}
    </section>
  );
}

export function BrandManualContent({ ariaLabel }: { ariaLabel?: string } = {}) {
  return (
    <article id="manual-content" className={styles.manual} data-brand-manual aria-label={ariaLabel}>
      <Page id="cover" chapter="cover" labelledBy="cover-title" tone="cover">
        <div className={styles.coverInner}>
          <ManualImage
            className={styles.coverLogo}
            src={CORECOORD_LOGO.horizontal}
            width={310}
            height={124}
            alt="芯坐标 CORECOORD"
            loading="eager"
            fetchPriority="high"
          />
          <h1 id="cover-title">
            视觉识别系统
            <br />
            与生成式内容规范
          </h1>
          <p className={styles.subtitle} lang="en">
            Visual identity &amp; generative content system
          </p>
          <p className={joinClasses(styles.coverMeta, styles.mono)}>
            APPROVED / 2026.1 · 2026-08-24
          </p>
        </div>
        <ManualImage
          className={styles.coverGraphic}
          src={CORECOORD_COORDINATE_FIELD}
          width={920}
          height={518}
          alt="由坐标网格、开放路径和多色节点组成的活性坐标图形"
          loading="eager"
        />
      </Page>

      <Page id="system-map" chapter="system-map" labelledBy="contents-title" number={2}>
        <Kicker>00 / System map</Kicker>
        <h2 id="contents-title">这是一套可执行系统，不是一组情绪图</h2>
        <div className={styles.gridWide}>
          <div>
            <p className={styles.lead}>
              品牌战略、课程证据、视觉令牌、模板与 LLM 工作流使用同一版本号和校验链。任何对外资产都能回答：依据是什么、谁批准、如何重放。
            </p>
            <div className={styles.grid3}>
              <div><span className={styles.stat}>265</span><p className={styles.small}>Office 课程文件完整提取</p></div>
              <div><span className={styles.stat}>135</span><p className={styles.small}>课次 / 9 个课程域</p></div>
              <div><span className={styles.stat}>42+</span><p className={styles.small}>自动审计检查项</p></div>
            </div>
            <p className={styles.small}>正式课程域与课次：00 AI 体验 3 · 01 AI 绘图 8 · 02 AI 配音 8 · 03 AI 视频 12 · 04 AI App 开发 20 · 05 AI 无人机创客 40 · 06 Python 基础 11 · 07 AI 数据分析 20 · 08 AI 素养与智能原理 13。</p>
          </div>
          <ol className={styles.contentsList} aria-label="章节列表">
            <li><b>01</b><span>品牌战略与人格</span></li>
            <li><b>02</b><span>教育闭环与能力轴</span></li>
            <li><b>03</b><span>活性坐标视觉哲学</span></li>
            <li><b>04</b><span>标志与联合品牌</span></li>
            <li><b>05</b><span>色彩、字体、网格</span></li>
            <li><b>06</b><span>辅助图形与影像</span></li>
            <li><b>07</b><span>动效、课程与营销模板</span></li>
            <li><b>08</b><span>LLM 生成与发布治理</span></li>
          </ol>
        </div>
        <FooterNote>规范源：guidelines/ · 机器源：llm-baseline/ · 执行源：deliverables/</FooterNote>
      </Page>

      <Page id="brand" chapter="brand" labelledBy="brand-title" number={3} tone="soft">
        <Kicker>01 / Brand definition</Kicker>
        <h2 id="brand-title">让 AI 成为孩子的超能力</h2>
        <div className={styles.gridWide}>
          <div>
            <p className={styles.lead}>
              芯坐标是一套以真实创作项目为载体的少儿 AI 素养教育体系，帮助学习者理解 AI、创造真实作品、负责任地使用 AI，让学习者在 AI 世界中找到方向，用真实作品建立自己的能力坐标。
            </p>
            <p className={styles.quote}>有方向的创造<br /><span className={styles.mono} lang="en">Create with direction.</span></p>
            <p className={styles.small}><b>课程主张</b><br />理解 AI · 创造作品 · 负责任地使用 AI</p>
          </div>
          <div>
            <div className={joinClasses(styles.panel, styles.softIndigo)}>
              <h3>不是工具速成</h3>
              <p>从明确目标、设计提示、协作生成、评估迭代和展示发布出发，而不是把提示词输入与一次成品当作完整学习。</p>
            </div>
            <div className={joinClasses(styles.panel, styles.softCoral, styles.panelGap)}>
              <h3>不是结果许诺</h3>
              <p>用作品、过程和测试证据说明学习，不以焦虑、收入、竞赛或“专业级”承诺推动购买。</p>
            </div>
          </div>
        </div>
      </Page>

      <Page id="brand-personality" chapter="brand" labelledBy="name-title" number={4}>
        <Kicker>01.1 / Name &amp; personality</Kicker>
        <h2 id="name-title">“芯”是核心，“坐标”是方向与证据</h2>
        <div className={styles.grid2}>
          <div className={styles.panel}><h3>芯 / CORE</h3><p>AI、计算与智能硬件的技术核心；每位学习者作为判断中心；好奇、创造与责任形成的能力内核。</p></div>
          <div className={styles.panel}><h3>坐标 / COORD</h3><p>明确目标、设计路径、测量进步、连接他人，并以作品、版本、测试和表达留下可见证据。</p></div>
        </div>
        <Rule />
        <div className={styles.grid4}>
          <div><h3>清醒</h3><p className={styles.small}>概念准确、层级清楚；不冷漠、不堆术语。</p></div>
          <div><h3>精致</h3><p className={styles.small}>比例与素材经得起检查；不靠奢华效果。</p></div>
          <div><h3>好奇</h3><p className={styles.small}>鼓励提问与试验；不追逐每一个热点。</p></div>
          <div><h3>可信</h3><p className={styles.small}>证据可追溯，承认边界；不做绝对承诺。</p></div>
        </div>
        <FooterNote>正式写法：芯坐标 CORECOORD；英文专名固定全大写，不展开为强制缩写。</FooterNote>
      </Page>

      <Page id="education" chapter="education" labelledBy="loop-title" number={5}>
        <Kicker>02 / Learning loop</Kicker>
        <h2 id="loop-title">五步学习闭环，把创造过程变得可见</h2>
        <p className={styles.lead}>每个项目不必平均占用五步，但必须让目标、提示、生成、评估和发布之间的关系清楚。</p>
        <div className={styles.stepRow}>
          {CORECOORD_LEARNING_LOOP.map((step) => (
            <div className={styles.step} key={step.id}>
              <b>{step.zh}</b>
              <span className={styles.mono}>{step.en.toUpperCase()}</span>
              <p className={styles.small}>{step.descriptionZh}</p>
            </div>
          ))}
        </div>
      </Page>

      <Page id="education-evidence" chapter="education" labelledBy="axis-title" number={6} tone="soft">
        <Kicker>02.1 / Capability &amp; evidence</Kicker>
        <h2 id="axis-title">四条能力轴，三层作品证据</h2>
        <div className={styles.grid4}>
          <div className={joinClasses(styles.axis, styles.axisCoral)}><h3>创意表达</h3><p className={styles.small}>图像、声音、故事、动态与交互如何表达意图。</p></div>
          <div className={joinClasses(styles.axis, styles.axisPurple)}><h3>计算构建</h3><p className={styles.small}>代码、应用、算法和硬件系统如何工作。</p></div>
          <div className={joinClasses(styles.axis, styles.axisTeal)}><h3>证据推理</h3><p className={styles.small}>数据、测试、比较与来源如何支持结论。</p></div>
          <div className={joinClasses(styles.axis, styles.axisAmber)}><h3>责任判断</h3><p className={styles.small}>隐私、权利、公平、安全与人的责任边界。</p></div>
        </div>
        <Rule />
        <div className={styles.grid3}>
          <div><span className={styles.stat}>01</span><h3>作品 / Outcome</h3><p className={styles.small}>做出了什么。</p></div>
          <div><span className={styles.stat}>02</span><h3>过程 / Process</h3><p className={styles.small}>版本、提示、代码、来源与选择。</p></div>
          <div><span className={styles.stat}>03</span><h3>验证 / Verification</h3><p className={styles.small}>测试、度量、反馈、反思与安全检查。</p></div>
        </div>
        <FooterNote>不得仅凭一张精修成品主张学习效果。课程域编号是内容组织，不自动对应固定年龄或年级。</FooterNote>
      </Page>

      <Page id="visual-concept" chapter="visual-concept" labelledBy="visual-title" number={7} tone="dark">
        <Kicker>03 / Living Coordinates</Kicker>
        <h2 id="visual-title">精密感来自秩序，活力来自真实行动</h2>
        <div className={styles.gridVisual}>
          <div>
            <p className={styles.lead}>点是发现与证据，线是关系与路径，刻度是可测量的进步，开放区域是仍可选择的下一步。</p>
            <p>它们必须帮助理解“从哪里出发、经过什么、抵达什么”，不能退化为电路板或泛科技装饰。</p>
            <span className={styles.pill}>明亮开放</span><span className={styles.pill}>真实作品</span><span className={styles.pill}>有目的的偏移</span>
          </div>
          <ManualImage src={CORECOORD_COORDINATE_FIELD} width={640} height={360} alt="活性坐标辅助图形：开放曲线连接五个彩色节点" />
        </div>
        <FooterNote>默认明亮；深色用于沉浸与高对比片段，不成为唯一品牌表情。</FooterNote>
      </Page>

      <Page id="logo" chapter="logo" labelledBy="logo-title" number={8}>
        <Kicker>04 / Identity system</Kicker>
        <h2 id="logo-title">正式标志是固定资产，不是可生成风格</h2>
        <ManualImage className={styles.logoHero} src={CORECOORD_LOGO.horizontal} width={510} height={204} alt="芯坐标 CORECOORD 横版彩色 Logo" />
        <div className={joinClasses(styles.grid3, styles.logoFacts)}>
          <div><h3>图形标</h3><p className={styles.small}>开放容器、中央核心留白与右上行动信号。</p></div>
          <div><h3>中文字标</h3><p className={styles.small}>定制转曲几何字形，不以系统字体替换。</p></div>
          <div><h3>英文字标</h3><p className={styles.small}>固定暖橘、宽字距与相对尺寸，不重新排字。</p></div>
        </div>
        <FooterNote>唯一来源：logo-final-2026/；SVG 中英文均已转曲，无字体依赖。</FooterNote>
      </Page>

      <Page id="logo-clearspace" chapter="logo" labelledBy="clear-title" number={9} tone="soft">
        <Kicker>04.1 / Space, size &amp; background</Kicker>
        <h2 id="clear-title">先保护识别，再选择组合</h2>
        <div className={styles.gridWide}>
          <div className={styles.clearspace}>
            <span className={joinClasses(styles.xLabel, styles.xTop)}>1X</span><span className={joinClasses(styles.xLabel, styles.xLeft)}>1X</span>
            <ManualImage src={CORECOORD_LOGO.horizontal} width={400} height={160} alt="带安全空间示意的横版 Logo" />
          </div>
          <div>
            <table>
              <thead><tr><th>场景</th><th>横版</th><th>图形标</th></tr></thead>
              <tbody>
                <tr><td>数字常规</td><td>≥ 280 px</td><td>≥ 24 px</td></tr>
                <tr><td>数字极小</td><td>改用图形标</td><td>16 px 仅 Favicon</td></tr>
                <tr><td>印刷</td><td>≥ 45 mm</td><td>≥ 8 mm</td></tr>
              </tbody>
            </table>
            <Rule />
            <h3>背景规则</h3>
            <p className={styles.small}>白/浅底使用彩色版；<code>#121A33</code> 深底使用反白版；摄影底优先构图留白，必要时使用完整纯色色带。安全空间最低 1X，联合品牌建议 1.5X。</p>
          </div>
        </div>
      </Page>

      <Page id="logo-guardrails" chapter="logo" labelledBy="guardrail-title" number={10}>
        <Kicker>04.2 / Identity guardrails</Kicker>
        <h2 id="guardrail-title">Logo 不参与风格探索</h2>
        <div className={styles.doDont}>
          <div className={styles.do}>
            <h3>正确</h3>
            <ManualImage className={styles.logoCorrect} src={CORECOORD_LOGO.horizontal} width={360} height={144} alt="正确的芯坐标横版 Logo" />
            <ul>
              <li>直接导入正式 SVG/PDF/PNG。</li><li>按背景切换官方彩色、反白或单色版。</li><li>视频和生成图完成后再后期叠加。</li>
            </ul>
          </div>
          <div className={styles.dont}>
            <h3>禁止</h3>
            <ul>
              <li>拉伸、旋转、裁切、描边、投影、发光或渐变。</li><li>替换中英文字形、调整字距或组件比例。</li><li>用课程域色替换 Logo 色。</li><li>把图形标拆成花纹或 Logo 轮廓平铺。</li><li>让图像/视频模型生成、重绘、补全或变形 Logo。</li><li>联合品牌时创建融合标志或共同胶囊容器。</li>
            </ul>
          </div>
        </div>
      </Page>

      <Page id="color" chapter="color" labelledBy="color-title" number={11}>
        <Kicker>05 / Core color</Kicker>
        <h2 id="color-title">稳定的核心色，明亮的内容世界</h2>
        <div className={styles.grid4}>
          <div className={joinClasses(styles.swatch, styles.swatchIndigo)}><b>Core Indigo</b><span>#22367B</span></div>
          <div className={joinClasses(styles.swatch, styles.swatchCoral)}><b>Signal Coral</b><span>#FC7358</span></div>
          <div className={joinClasses(styles.swatch, styles.swatchOrange)}><b>Wordmark Orange</b><span>#F16C3E</span></div>
          <div className={joinClasses(styles.swatch, styles.swatchReverse)}><b>Reverse Background</b><span>#121A33</span></div>
        </div>
        <Rule />
        <div className={styles.grid3}>
          <div><h3>默认比例</h3><p>中性 <code>65–80%</code>；靛蓝 <code>10–20%</code>；单个课程色 <code>5–15%</code>；珊瑚/橘总计通常不超过 <code>10%</code>。</p></div>
          <div><h3>角色优先</h3><p>Logo 色固定；正文、状态与课程导航使用令牌中的 <code>accent / strong / soft / on-accent</code>。</p></div>
          <div><h3>印刷管理</h3><p>屏幕母版 sRGB；CMYK 根据承印条件与 ICC 输出意图转换并打样，不声明万能数值。</p></div>
        </div>
        <FooterNote>完整色阶与语义角色：deliverables/tokens/corecoord.tokens.json</FooterNote>
      </Page>

      <Page id="color-stage" chapter="color" labelledBy="stage-title" number={12} tone="soft">
        <Kicker>05.1 / Course domain color</Kicker>
        <h2 id="stage-title">九个内容域，一套主品牌</h2>
        <div className={styles.gridVisual}>
          <div>
            <p>课程色用于导航、节点与比较，不创建九套子品牌。编号与名称必须与颜色一起出现。</p>
            <p className={styles.small}><b>Accent</b> 色块与节点<br /><b>Strong</b> 浅底文字与线<br /><b>Soft</b> 低强调背景<br /><b>On accent</b> 指定反差文字</p>
            <p className={styles.small}>一张主画面通常选择一个课程域色。多课程比较时保留编号、名称或符号作为冗余信息。</p>
          </div>
          <ManualImage src={asset("deliverables/assets/svg/corecoord-stage-palette.svg")} width={640} height={533} alt="九个课程域的色彩表，分别列出强调色、深色文字色和浅色背景色" />
        </div>
      </Page>

      <Page id="color-contrast" chapter="color" labelledBy="contrast-title" number={13}>
        <Kicker>05.2 / Accessible color</Kicker>
        <h2 id="contrast-title">亮色负责识别，深色负责阅读</h2>
        <div className={styles.grid2}>
          <div>
            <div className={joinClasses(styles.contrastPair, styles.contrastIndigo)}><b>白字 / Core Indigo</b><span>11.16:1</span></div>
            <div className={joinClasses(styles.contrastPair, styles.contrastReverse)}><b>白字 / Reverse</b><span>17.20:1</span></div>
            <div className={joinClasses(styles.contrastPair, styles.contrastCoral)}><b>Ink / Signal Coral</b><span>6.29:1</span></div>
            <div className={joinClasses(styles.contrastPair, styles.contrastAmber)}><b>Ink / Data Amber</b><span>7.79:1</span></div>
          </div>
          <div>
            <h3>最低标准</h3>
            <p>正常文字 <code>4.5:1</code>；大文字与关键非文本 <code>3:1</code>。Signal Coral 与 Wordmark Orange 不作为白底小正文。</p>
            <h3>必须同时做到</h3>
            <p>颜色不是课程域、状态、正确/错误或进度的唯一信号；同时使用编号、名称、图标、线型或文字。</p>
            <h3>自动审计</h3>
            <p>正式组合共 35 项，当前全部通过。新组合必须进入同一对比度检查。</p>
          </div>
        </div>
        <FooterNote>审计：deliverables/audits/color-contrast.md · 标准：WCAG 2.2 AA</FooterNote>
      </Page>

      <Page id="type" chapter="type" labelledBy="type-title" number={14}>
        <Kicker>06 / Typography</Kicker>
        <h2 id="type-title">统一双语骨架，按内容调整密度</h2>
        <div className={styles.gridWide}>
          <div>
            <p className={styles.typeHero}>找到问题，<br />构建可以验证的作品。</p>
            <p className={styles.typeEnglish} lang="en">Define the goal.<br />Build work you can test.</p>
            <p className={joinClasses(styles.mono, styles.typeMono)}>DEFINE / PROMPT / GENERATE / EVALUATE / PUBLISH</p>
          </div>
          <div>
            <table>
              <thead><tr><th>角色</th><th>字体</th><th>字重</th></tr></thead>
              <tbody>
                <tr><td>标题/正文</td><td>Noto Sans SC</td><td>400 / 500 / 600 / 700</td></tr>
                <tr><td>代码/坐标</td><td>Noto Sans Mono CJK SC</td><td>400 / 500 / 700</td></tr>
                <tr><td>Logo</td><td>官方转曲字形</td><td>不作为排版字体</td></tr>
              </tbody>
            </table>
            <Rule />
            <p className={styles.small}>字距默认 0；中文左对齐，不强制两端对齐；标题自然换行，不自动缩至不可读；中文与英文/数字之间留半角空格。</p>
            <p className={styles.small}>屏幕正文至少 16 px；移动端使用离散字号，不随视口连续缩放。低龄内容加大字号和行距，而不是换成幼稚字体。</p>
          </div>
        </div>
        <FooterNote>字体包：Noto Sans CJK 2.004 / TTF variable / OFL 1.1</FooterNote>
      </Page>

      <Page id="layout" chapter="layout" labelledBy="layout-title" number={15} tone="soft">
        <Kicker>07 / Grid &amp; space</Kicker>
        <h2 id="layout-title">先建立阅读顺序，再决定视觉张力</h2>
        <div className={styles.grid2}>
          <div>
            <h3>数字网格</h3>
            <table>
              <thead><tr><th>画布</th><th>列</th><th>边距</th><th>列距</th></tr></thead>
              <tbody>
                <tr><td>≥ 1440 px</td><td>12</td><td>64 px</td><td>24 px</td></tr>
                <tr><td>1024–1439</td><td>12</td><td>48 px</td><td>20 px</td></tr>
                <tr><td>768–1023</td><td>8</td><td>32 px</td><td>16 px</td></tr>
                <tr><td>&lt; 768</td><td>4</td><td>20 px</td><td>12 px</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3>空间与造型</h3>
            <p>基础网格 <code>8 px</code>，微调 <code>4 px</code>；常用间距 <code>8 / 12 / 16 / 24 / 32 / 48 / 64 / 96</code>。</p>
            <p>圆角仅 <code>2 / 4 / 8 px</code>。页面区块依靠留白、色带、分隔线和栅格；不把所有内容做成漂浮卡片，也不嵌套卡片。</p>
            <h3>稳定尺寸</h3>
            <p>板面、按钮、图标、计数器、视频框与固定画幅使用明确尺寸或比例，内容变化不能推动布局跳动。</p>
          </div>
        </div>
        <Rule />
        <div className={styles.flow} aria-label="信息层级">
          <div><b>01 主体</b><span>项目、作品或具体问题</span></div>
          <div><b>02 行动</b><span>学习者正在做什么</span></div>
          <div><b>03 证据</b><span>版本、测试或解释</span></div>
          <div><b>04 下一步</b><span>一个清楚 CTA</span></div>
        </div>
      </Page>

      <Page id="graphics" chapter="graphics" labelledBy="graphics-title" number={16}>
        <Kicker>08 / Graphic language</Kicker>
        <h2 id="graphics-title">每一条线都要有含义</h2>
        <div className={styles.gridVisual}>
          <div>
            <table>
              <thead><tr><th>组件</th><th>语义</th></tr></thead>
              <tbody>
                <tr><td>原点</td><td>学习者、发现、决定性起点</td></tr>
                <tr><td>节点</td><td>证据、版本、测试决定</td></tr>
                <tr><td>开放路径</td><td>过程、关系、迁移与下一步</td></tr>
                <tr><td>刻度</td><td>真实测量、阶段或时间</td></tr>
                <tr><td>网格</td><td>定位、比较和结构支撑</td></tr>
              </tbody>
            </table>
            <p className={styles.small}>标准线宽 2 px；展示路径按画幅 3–12 px；节点至少为线宽 3 倍。网格使用低对比中性色且不穿过正文。</p>
            <p className={styles.small}>禁止无意义波浪、电路板、HUD、二进制雨、科技六边形、渐变光球与 Logo 轮廓花纹。</p>
          </div>
          <ManualImage src={CORECOORD_COORDINATE_FIELD} width={640} height={360} alt="带网格、开放路径和多色节点的辅助图形示例" />
        </div>
      </Page>

      <Page id="imagery" chapter="imagery" labelledBy="photo-title" number={17} tone="soft">
        <Kicker>09 / Photography &amp; video</Kicker>
        <h2 id="photo-title">拍学习发生的动作，不拍“正在用电脑”</h2>
        <div className={styles.doDont}>
          <div className={styles.do}>
            <h3>优先捕捉</h3>
            <ul>
              <li>手、眼神、材料、代码、测试与具体作品。</li><li>明确目标、设计提示、协作生成、评估迭代和展示发布。</li><li>动作发生前后与版本之间的可见变化。</li><li>学习者高度、自然肤色、真实材质与负空间。</li><li>多样而自然的角色与协作关系。</li>
            </ul>
          </div>
          <div className={styles.dont}>
            <h3>避免</h3>
            <ul>
              <li>整齐排坐、统一对镜头微笑、空泛屏幕操作。</li><li>持续俯拍、成人化儿童、技术角色刻板分配。</li><li>青橙重调色、赛博朋克暗房与过度 HDR。</li><li>模糊主体来为文字腾空间，或生成乱码界面。</li><li>未经授权的姓名、学校、账号、位置与生物特征。</li>
            </ul>
          </div>
        </div>
        <FooterNote>画面至少能辨认 Define / Prompt / Generate / Evaluate / Publish 中的一种动作。</FooterNote>
      </Page>

      <Page id="imagery-graphics" chapter="imagery" labelledBy="content-graphics-title" number={18}>
        <Kicker>09.1 / Illustration, icon &amp; data</Kicker>
        <h2 id="content-graphics-title">解释优先于装饰</h2>
        <div className={styles.grid3}>
          <div className={joinClasses(styles.panel, styles.softCoral)}><h3>插画</h3><p>用于抽象系统和无法拍摄的概念；清晰几何轮廓、有限色面和真实空间关系。不模仿具体在世艺术家或流行 IP。</p></div>
          <div className={joinClasses(styles.panel, styles.softIndigo)}><h3>图标与控件</h3><p>同一界面使用一套成熟线性图标；20/24 px、约 2 px 描边。陌生图标配标签或 Tooltip；常规儿童触控目标优先 44 × 44 px。</p></div>
          <div className={joinClasses(styles.panel, styles.softGreen)}><h3>数据图表</h3><p>先回答一个问题；显示轴、单位、时间、样本与来源。用标签、线型和形状冗余编码；不使用 3D 饼图和误导性截轴。</p></div>
        </div>
        <Rule />
        <p className={styles.lead}>学习进度表达“已有证据与下一步”，不把复杂能力压成一个看似精确的总分。</p>
        <p className={styles.small}>生成式插画必须标记来源；Logo、准确文字、图表数据与二维码在后期确定性合成。</p>
      </Page>

      <Page id="motion" chapter="motion" labelledBy="motion-title" number={19} tone="dark">
        <Kicker>10 / Motion &amp; sound</Kicker>
        <h2 id="motion-title">运动有来源、有方向、有停驻</h2>
        <div className={styles.stepRow}>
          <div className={styles.step}><b>80 ms</b><span>即时按压反馈</span></div><div className={styles.step}><b>160 ms</b><span>小状态变化</span></div><div className={styles.step}><b>240 ms</b><span>默认过渡</span></div><div className={styles.step}><b>400 ms</b><span>教学步骤转换</span></div><div className={styles.step}><b>700 ms</b><span>品牌叙事节拍</span></div>
        </div>
        <div className={joinClasses(styles.grid3, styles.motionFacts)}>
          <div><h3>缓动</h3><p className={joinClasses(styles.small, styles.mono)}>cubic-bezier(.2, 0, 0, 1)</p></div>
          <div><h3>动态安全</h3><p className={styles.small}>不超过每秒 3 次闪烁；超过 5 秒自动运动提供暂停；尊重减少动态偏好。</p></div>
          <div><h3>声音</h3><p className={styles.small}>对白优先于音乐；保留字幕、文字稿和无音乐版。按渠道测响度，不使用万能 LUFS。</p></div>
        </div>
      </Page>

      <Page id="course" chapter="course" labelledBy="course-title" number={20}>
        <Kicker>11 / Course communication</Kicker>
        <h2 id="course-title">课程材料让任务、过程和检查方式一眼可见</h2>
        <div className={styles.grid2}>
          <div>
            <h3>封面顺序</h3>
            <ol><li>芯坐标正式 Logo</li><li>课程域编号与名称</li><li>项目/课次标题</li><li>一句具体任务</li><li>版本与教师/学生标识</li></ol>
            <h3>演示文稿</h3>
            <p>16:9，安全边距至少 64 px；课堂正文建议 ≥ 24 px；一页一个主要信息目标。</p>
          </div>
          <div>
            <h3>学习单与项目档案</h3>
            <p>显示闭环步骤、预计时间、输入、产出和检查方式；为书写、草图、版本比较与反思留真实空间。</p>
            <p>项目档案至少包含：目标、提示、初版、一次评估迭代、最终版、学习者说明和权限状态。</p>
            <h3>年龄密度</h3>
            <p>启蒙用大形状与短句；进阶创作增加角色与版本；工程/数据允许参数、代码和测试点。课程编号不自动等于年级。</p>
          </div>
        </div>
        <FooterNote>对外课程事实必须来自 research/course-baseline.json 与 evidence 记录。</FooterNote>
      </Page>

      <Page id="course-templates" chapter="course" labelledBy="course-template-title" number={21} tone="soft">
        <Kicker>11.1 / Course templates</Kicker>
        <h2 id="course-template-title">课程与学习证据模板</h2>
        <div className={styles.templateGrid}>
          <div className={styles.templateItem}><ManualImage src={asset("deliverables/previews/corecoord-presentation-cover-16x9.png")} width={640} height={360} alt="智能硬件课程演示封面模板" /><p><b>Presentation 16:9</b><br />课程域、任务、版本与主视觉。</p></div>
          <div className={styles.templateItem}><ManualImage src={asset("deliverables/previews/corecoord-worksheet-a4.png")} width={640} height={905} alt="数据推理项目学习单模板" /><p><b>Worksheet A4</b><br />五步闭环、草图区与评估迭代记录。</p></div>
          <div className={styles.templateItem}><ManualImage src={asset("deliverables/previews/corecoord-certificate-a4-landscape.png")} width={640} height={452} alt="项目学习证书模板" /><p><b>Certificate A4</b><br />证书记录作品证据，不宣称模糊等级。</p></div>
        </div>
      </Page>

      <Page id="marketing" chapter="marketing" labelledBy="marketing-template-title" number={22}>
        <Kicker>12 / Marketing templates</Kicker>
        <h2 id="marketing-template-title">同一视觉骨架，适配不同传播画幅</h2>
        <div className={styles.templateGrid}>
          <div className={styles.templateItem}><ManualImage src={asset("deliverables/previews/corecoord-social-4x5.png")} width={640} height={800} alt="4 比 5 应用构建课程社交模板" /><p><b>4:5 Feed</b><br />主体、证据与一个 CTA。</p></div>
          <div className={styles.templateItem}><ManualImage src={asset("deliverables/previews/corecoord-story-9x16.png")} width={540} height={960} alt="9 比 16 动态叙事竖屏模板" /><p><b>9:16 Story</b><br />保留平台界面安全区与字幕区。</p></div>
          <div className={styles.templateItem}><ManualImage src={asset("deliverables/previews/corecoord-poster-a3.png")} width={640} height={905} alt="A3 视觉创作项目海报模板" /><p><b>A3 Poster</b><br />真实作品主视觉与过程证据。</p></div>
        </div>
      </Page>

      <Page id="marketing-format" chapter="marketing" labelledBy="format-title" number={23} tone="soft">
        <Kicker>12.1 / Message &amp; format</Kicker>
        <h2 id="format-title">第一信号永远是项目、作品或具体问题</h2>
        <div className={styles.grid2}>
          <div>
            <table>
              <thead><tr><th>画幅</th><th>基础安全区</th></tr></thead>
              <tbody>
                <tr><td>1080 × 1080</td><td>64 px</td></tr><tr><td>1080 × 1350</td><td>64 px</td></tr><tr><td>1080 × 1920</td><td>左右 72 / 上下 160 px</td></tr><tr><td>1920 × 1080</td><td>96 px</td></tr><tr><td>A4</td><td>建议 18 mm 版心边距</td></tr>
              </tbody>
            </table>
            <p className={styles.small}>渠道 UI、上传限制和裁切会变化，导出前查看规格注册表的核验日期。</p>
          </div>
          <div>
            <div className={joinClasses(styles.flow, styles.formatFlow)}>
              <div><b>主体</b><span>真实项目或清楚概念</span></div><div><b>行动</b><span>明确目标、协作生成或评估迭代</span></div><div><b>能力</b><span>最多两条能力轴</span></div><div><b>证据 + CTA</b><span>可核验事实与一个入口</span></div>
            </div>
            <p className={styles.formatNote}>不以巨型抽象口号覆盖第一视口；一张静态图或一个短视频只保留一个主 CTA。</p>
          </div>
        </div>
      </Page>

      <Page id="llm" chapter="llm" labelledBy="llm-title" number={24}>
        <Kicker>13 / LLM production</Kicker>
        <h2 id="llm-title">模型生成内容层，系统合成品牌层</h2>
        <div className={styles.flow}>
          <div><b>事实层</b><span>课程基线、证据、权利与渠道规格</span></div><div><b>生成层</b><span>文案草稿、clean plate、分镜与镜头</span></div><div><b>合成层</b><span>正式 Logo、字体、字幕、CTA 与来源</span></div><div><b>治理层</b><span>Schema、哈希、审核、版本与撤回</span></div>
        </div>
        <Rule />
        <div className={styles.grid2}>
          <div><h3>模型可以</h3><p>生成无品牌标识的概念图、对象/环境、镜头候选、抽象路径动效和受证据约束的文案草稿。</p></div>
          <div><h3>模型不可以</h3><p>生成 Logo、准确中文字、二维码、法律信息、真实凭证、虚构课程成果或未授权真实学员形象。</p></div>
        </div>
        <FooterNote>提示词源：llm-baseline/prompts/ · 生产协议：workflows/llm-marketing-production-workflow.md</FooterNote>
      </Page>

      <Page id="llm-provenance" chapter="llm" labelledBy="truth-title" number={25} tone="coral">
        <Kicker>13.1 / Truth &amp; provenance</Kicker>
        <h2 id="truth-title">来源标识不是免责声明，而是生产事实</h2>
        <div className={styles.grid3}>
          <div className={styles.panel}><span className={styles.stat}>REAL</span><p>真实拍摄或作品。保留授权、日期、场景与编辑记录；不添加不存在的人、设备或成绩。</p></div>
          <div className={styles.panel}><span className={styles.stat}>SYNTHETIC</span><p>模型生成或完全构建的概念视觉。不得描述为真实课堂、真实学员或真实成果。</p></div>
          <div className={styles.panel}><span className={styles.stat}>HYBRID</span><p>真实与生成内容混合。记录生成/替换区域和会影响观者判断的编辑。</p></div>
        </div>
        <Rule />
        <div className={styles.grid2}>
          <div><h3>每个资产必须保存</h3><p className={styles.small}>已验证简报、证据/权利、准确提示词、模型与版本、原始输出、后期源文件、审核记录、发布文件与校验值。</p></div>
          <div><h3>来源技术</h3><p className={styles.small}>支持时嵌入 C2PA Content Credentials；不支持时交付 JSON sidecar。来源证明制作链路，不自动证明内容真实。</p></div>
        </div>
      </Page>

      <Page id="qa" chapter="qa" labelledBy="qa-title" number={26}>
        <Kicker>14 / Export &amp; quality</Kicker>
        <h2 id="qa-title">发布是一组可复查的文件，不是一张“最终版”</h2>
        <div className={styles.grid3}>
          <div><h3>数字图片</h3><p className={styles.small}>sRGB；图形/Logo 优先 SVG，透明位图用 PNG/WebP；从矢量在目标尺寸或整数倍超采样导出，不放大截图。</p></div>
          <div><h3>视频</h3><p className={styles.small}>逐行、原生帧率、Rec.709、48 kHz；常规上传从 MP4/H.264 4:2:0/AAC-LC/fast start 开始；字幕与文字稿独立交付。</p></div>
          <div><h3>印刷</h3><p className={styles.small}>PDF/X-4、嵌入字体与输出意图；通常 3 mm 出血，以承印商为准；正式批量前打样。</p></div>
        </div>
        <Rule />
        <div className={styles.grid2}>
          <div><h3>自动检查</h3><p className={styles.small}>文件名、尺寸、色域、Logo 哈希、对比度、Schema、SVG 语法、旧品牌、占位符、编码、字幕与校验值。</p></div>
          <div><h3>人工签核</h3><p className={styles.small}>课程事实、年龄与安全；品牌层级与影像；权利和儿童隐私；真实设备可访问性；渠道裁切、CTA 与发布链接。</p></div>
        </div>
        <FooterNote>文件名：cc-[asset]-[topic]-[ratio]-[language]-[theme]-v[major.minor].[ext]</FooterNote>
      </Page>

      <Page id="standards" chapter="standards" labelledBy="standards-title" number={27} tone="dark">
        <Kicker>15 / International baseline</Kicker>
        <h2 id="standards-title">采用当前标准，也明确不做虚假合规声明</h2>
        <div className={styles.grid2}>
          <table>
            <thead><tr><th>领域</th><th>基线</th></tr></thead>
            <tbody>
              <tr><td>无障碍</td><td>WCAG 2.2 Recommendation</td></tr><tr><td>设计令牌</td><td>DTCG Format 2025.10</td></tr><tr><td>印刷色彩</td><td>ICC.1:2022 / v4.4</td></tr><tr><td>印刷交付</td><td>ISO 15930-7 PDF/X-4</td></tr><tr><td>PDF 可访问</td><td>ISO 14289-2:2024 PDF/UA-2</td></tr>
            </tbody>
          </table>
          <table>
            <thead><tr><th>领域</th><th>基线</th></tr></thead>
            <tbody>
              <tr><td>儿童与 AI</td><td>UNICEF AI and Children 3.0</td></tr><tr><td>AI 教育</td><td>UNESCO AI competency / GenAI guidance</td></tr><tr><td>来源凭证</td><td>C2PA 2.4 / sidecar fallback</td></tr><tr><td>图像元数据</td><td>IPTC Photo Metadata 2025.1</td></tr><tr><td>视频</td><td>YouTube 官方编码建议 / EBU R128</td></tr>
            </tbody>
          </table>
        </div>
        <Rule />
        <p>可访问 HTML 是手册数字母版；PDF 是固定版式交付。只有完成语义标记、阅读顺序、替代文本和辅助技术测试后，才可声明 PDF/UA 合规。</p>
        <FooterNote>完整一手来源与核验日期：research/international-vi-standards-2026.md</FooterNote>
      </Page>

      <Page id="assets" chapter="assets" labelledBy="assets-title" number={28}>
        <Kicker>16 / Delivery map</Kicker>
        <h2 id="assets-title">一套源文件，四种使用入口</h2>
        <div className={styles.grid4}>
          <div className={joinClasses(styles.panel, styles.softIndigo)}><h3>人阅读</h3><p className={styles.small}><code>manual/index.html</code><br /><code>manual/output/pdf/</code><br /><code>guidelines/</code></p></div>
          <div className={joinClasses(styles.panel, styles.softCoral)}><h3>设计制作</h3><p className={styles.small}><code>deliverables/templates/</code><br /><code>deliverables/assets/</code><br /><code>deliverables/fonts/</code></p></div>
          <div className={joinClasses(styles.panel, styles.softGreen)}><h3>代码接入</h3><p className={styles.small}><code>corecoord.tokens.json</code><br /><code>corecoord.css</code><br /><code>schemas/</code></p></div>
          <div className={joinClasses(styles.panel, styles.softAmber)}><h3>LLM 生产</h3><p className={styles.small}><code>llm-baseline/</code><br /><code>prompts/</code><br /><code>workflows/</code></p></div>
        </div>
        <Rule />
        <div className={styles.gridWide}>
          <div>
            <h3>版本</h3>
            <p className={styles.lead}>CORECOORD VI 2026.1<br />Logo Final 2026.1</p>
            <p className={styles.small}>Major：身份/战略不兼容变化；Minor：新增域、模板或令牌；Patch：错误、无障碍或导出修复。</p>
          </div>
          <div>
            <h3>发布前最后五问</h3>
            <p className={styles.small}>是否一眼看出少儿 AI 教育？<br />是否看见行动、作品或证据？<br />事实和权利是否可追溯？<br />Logo、文字、色彩和可访问性是否合规？<br />是否只有一个清楚的下一步？</p>
          </div>
        </div>
        <FooterNote>系统自动审计：node scripts/validate_vi_system.mjs · 本页不是授权签名，正式责任人写入生产简报。</FooterNote>
      </Page>
    </article>
  );
}
