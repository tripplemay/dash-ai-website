import type { Metadata } from "next";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { CoordinateField } from "@/components/coordinate-field";
import { CourseWizard } from "@/components/course-wizard";
import { listEnabledResources } from "@/lib/db";

export const metadata: Metadata = { title: "课件向导" };

// 课件模板列表来自 resources 表，运行时查询
export const dynamic = "force-dynamic";

export default function CourseWizardPage() {
  const t = useTranslations("wizard");
  const templates = listEnabledResources({ categoryKey: "course-templates" })
    .map(({ id, title, kind, file_key }) => ({ id, title, kind, file_key }));

  return (
    <>
      <section className="relative overflow-hidden bg-reverse-background pt-11 pb-8.5 text-white">
        <CoordinateField className="absolute top-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title")}
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-neutral-300">{t("sub")}</div>
        </div>
      </section>
      <Suspense>
        <CourseWizard templates={templates} />
      </Suspense>
    </>
  );
}
