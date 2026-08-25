import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AppPageHero } from "@/components/app-page-hero";
import { CourseWizard } from "@/components/course-wizard";
import { listEnabledResources } from "@/lib/db";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "wizard");
}

// 课件模板列表来自 resources 表，运行时查询
export const dynamic = "force-dynamic";

export default function CourseWizardPage() {
  const t = useTranslations("wizard");
  const templates = listEnabledResources({ categoryKey: "course-templates" })
    .map(({ id, title, kind, file_key }) => ({ id, title, kind, file_key }));

  return (
    <>
      <AppPageHero>
        <h1 className="text-[32px] font-extrabold tracking-[2px]">
          {t("title")}
        </h1>
        <div className="mt-2 text-[13.5px] tracking-wide text-neutral-300">{t("sub")}</div>
      </AppPageHero>
      <Suspense>
        <CourseWizard templates={templates} />
      </Suspense>
    </>
  );
}
