import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Spotlight } from "@/components/aceternity/spotlight";
import { ResourceCenter } from "@/components/resource-center";
import { listEnabledResources } from "@/lib/db";
import { getPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "resources");
}

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("resources");
  const params = (await searchParams) ?? {};
  const value = (key: string) => {
    const item = params[key];
    return Array.isArray(item) ? item[0] : item;
  };
  const cat = value("cat");
  const q = value("q");
  const sort = value("sort");
  const items = listEnabledResources({
    category: cat,
    query: q,
    sort: sort === "recent" || sort === "name" ? sort : "default",
  });
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title1")}
            <em className="not-italic text-cyan">{t("title2")}</em>
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-[#9FB3E8]">{t("sub")}</div>
        </div>
      </section>
      <Suspense>
        <ResourceCenter items={items} initialQuery={q ?? ""} initialCategory={cat ?? "全部"} initialSort={sort ?? "default"} />
      </Suspense>
    </>
  );
}
