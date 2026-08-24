import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BrandManualViewer } from "@/components/brand-manual-viewer";

export const metadata: Metadata = { title: "品牌规范" };

// VI 手册使用版本化、可复现的发布资产；嵌入时由网站侧栏统一承载章节导航。
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
        <Link href="/help/guide" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-neutral-600 hover:text-coral-700">
          <ArrowLeft className="size-3.5" />
          {t("guide")}
        </Link>
        <span className="text-[18px] font-extrabold text-indigo-800">{t("brand")}</span>
      </div>
      <BrandManualViewer />
    </div>
  );
}
