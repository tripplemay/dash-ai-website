import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BrandManualContent } from "@/components/brand-manual-content";

export const metadata: Metadata = { title: "品牌规范" };

// The manual is rendered in the application shell so it shares the site's navigation and responsive behavior.
export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  const brandManualT = await getTranslations({ locale, namespace: "brandManual" });
  return (
    <div className="min-w-0">
      <div className="flex w-full items-center gap-4 px-5 py-4 sm:px-7">
        <Link href="/help/guide" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-neutral-600 hover:text-coral-700">
          <ArrowLeft className="size-3.5" />
          {t("guide")}
        </Link>
        <span className="text-[18px] font-extrabold text-indigo-800">{t("brand")}</span>
      </div>
      <BrandManualContent ariaLabel={brandManualT("contentLabel")} />
    </div>
  );
}
