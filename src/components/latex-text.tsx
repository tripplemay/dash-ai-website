import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

/**
 * 混合文本渲染：$...$ 行内公式与 $$...$$ 独立行公式经 KaTeX 渲染，其余按原文换行。
 * 用于练习题干/选项/解析/参考答案（抽取管线输出 LaTeX 标记）。
 * 无公式片段时退回纯文本（零开销路径）。KaTeX 输出无脚本，可安全注入 HTML。
 */

const LATEX_PATTERN = String.raw`\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$`;

function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, { displayMode, throwOnError: false, strict: false });
  } catch {
    return formula;
  }
}

export function LatexText({ text, className }: { text: string; className?: string }) {
  const regex = new RegExp(LATEX_PATTERN, "g");
  if (!regex.test(text)) return <span className={className}>{text}</span>;
  regex.lastIndex = 0;

  const segments: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > last) segments.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    const formula = match[1] ?? match[2] ?? "";
    const displayMode = match[1] !== undefined;
    segments.push(
      <span
        key={key++}
        className={displayMode ? "my-1.5 block overflow-x-auto" : "inline-block align-middle"}
        // KaTeX 输出为纯排版 HTML（无脚本/无事件），throwOnError:false 保证坏公式降级为原文
        dangerouslySetInnerHTML={{ __html: renderKatex(formula, displayMode) }}
      />
    );
    last = regex.lastIndex;
  }
  if (last < text.length) segments.push(<span key={key++}>{text.slice(last)}</span>);
  return <span className={className}>{segments}</span>;
}
