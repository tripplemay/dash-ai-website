import type { Metadata } from "next";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Spotlight } from "@/components/aceternity/spotlight";
import { CourseWizard } from "@/components/course-wizard";
import { listEnabledResources } from "@/lib/db";

export const metadata: Metadata = { title: "课件向导" };

// 课件模板列表来自 resources 表，运行时查询
export const dynamic = "force-dynamic";

export default function CourseWizardPage() {
  const t = useTranslations("wizard");
  const templates = listEnabledResources()
    .filter((r) => r.category === "课件模板")
    .map(({ id, title, kind, file_key }) => ({ id, title, kind, file_key }));

  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title")}
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-[#9FB3E8]">{t("sub")}</div>
        </div>
      </section>
      <Suspense>
        <CourseWizard templates={templates} />
      </Suspense>
    </>
  );
}
