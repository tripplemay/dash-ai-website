import type { Metadata } from "next";

export const metadata: Metadata = { title: "品牌规范" };

// VI 手册为静态图集（public/brand），以整幅 iframe 嵌入站点框架，
// 保留站头导航；手册自身在 iframe 内滚动。
export default function BrandPage() {
  return (
    <iframe
      src="/brand/index.html"
      title="DASH AI 品牌视觉识别规范手册"
      className="block w-full border-0 bg-white"
      style={{ height: "calc(100vh - 62px)" }}
    />
  );
}
