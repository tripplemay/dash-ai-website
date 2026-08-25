import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CoordinateField } from "@/components/coordinate-field";
import { ResourceCenter } from "@/components/resource-center";
import { listEnabledResourcesPage } from "@/lib/db";
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
  const cursor = value("cursor");
  const page = listEnabledResourcesPage({
    category: cat,
    query: q,
    sort: sort === "recent" || sort === "name" ? sort : "default",
    cursor,
  });
  return (
    <>
      <section className="relative overflow-hidden bg-reverse-background pt-11 pb-8.5 text-white">
        <CoordinateField className="absolute top-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
        <div className="relative z-10 w-full px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title1")}
            <em className="not-italic text-coral-300">{t("title2")}</em>
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-neutral-300">{t("sub")}</div>
        </div>
      </section>
      <Suspense>
        <ResourceCenter
          items={page.items}
          nextCursor={page.nextCursor}
          initialQuery={q ?? ""}
          initialCategory={cat ?? "全部"}
          initialSort={sort ?? "default"}
        />
      </Suspense>
    </>
  );
}
