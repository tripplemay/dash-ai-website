import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "品牌规范" };

// VI 手册为静态图集（public/brand），以整幅 iframe 嵌入站点框架，
// 保留站头导航；手册自身在 iframe 内滚动。
export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return (
    <div className="min-w-0">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-4 sm:px-7">
        <Link href="/help/guide" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-subtext hover:text-cyan-print">
          <ArrowLeft className="size-3.5" />
          {t("guide")}
        </Link>
        <span className="text-[18px] font-extrabold text-navy">{t("brand")}</span>
      </div>
      <div className="overflow-x-auto border-y border-[#DCE6F7] bg-[#DCE4F2]">
        <iframe
          src="/brand/index.html"
          title="DASH AI 品牌视觉识别规范手册"
          loading="lazy"
          className="block min-w-[960px] w-full border-0 bg-white"
          style={{ height: "calc(100vh - 132px)" }}
        />
      </div>
    </div>
  );
}
