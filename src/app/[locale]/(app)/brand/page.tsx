import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "品牌规范" };

// VI 手册使用版本化、可复现的发布资产；手册自身在 iframe 内滚动。
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
      <div className="overflow-x-auto border-y border-neutral-200 bg-neutral-100">
        <iframe
          src="/assets/brand/corecoord/2026.1/vi-system-2026/manual/index.html"
          title="CORECOORD 芯坐标品牌视觉识别规范手册"
          loading="lazy"
          className="block w-full border-0 bg-white"
          style={{ height: "calc(100vh - 132px)" }}
        />
      </div>
    </div>
  );
}
