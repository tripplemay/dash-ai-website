import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Download, Eye, FolderOpen } from "lucide-react";
import { getResource } from "@/lib/db";
import { resourceFileUrl, resourcePreviewUrl } from "@/lib/assets";
import { RESOURCE_CATS } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resource = getResource(Number(id));
  return { title: resource?.title ?? "资源详情" };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const resource = getResource(Number(id));
  if (!resource || !resource.enabled) notFound();
  const t = await getTranslations({ locale, namespace: "resources" });
  const categoryLabels = t.raw("categories") as string[];
  const fileHref = resourceFileUrl(resource.file_key) || `/api/download/${resource.id}`;

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-7 sm:px-7 lg:py-10">
      <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-neutral-600">
        <Link href="/resources" className="hover:text-coral-700">{t("title1")} {t("title2")}</Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-indigo-800">{resource.title}</span>
      </nav>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resourcePreviewUrl(resource.preview)}
            alt=""
            width={1200}
            height={750}
            fetchPriority="high"
            decoding="async"
            className="aspect-[16/10] w-full bg-reverse-background object-cover"
          />
        </div>
        <section>
          <div className="text-[11px] font-extrabold tracking-[2px] text-coral-700">
            {categoryLabels[RESOURCE_CATS.indexOf(resource.category)] ?? resource.category}
          </div>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-wide text-indigo-800">{resource.title}</h1>
          <dl className="mt-5 space-y-2 rounded-lg border border-neutral-200 bg-card p-4 text-[13px]">
            {resource.dimensions && <div className="flex justify-between gap-4"><dt className="text-neutral-600">{t("dimensions")}</dt><dd className="text-right font-bold text-indigo-800">{resource.dimensions}</dd></div>}
            {resource.print_advice && <div className="flex justify-between gap-4"><dt className="text-neutral-600">{t("adviceLabel")}</dt><dd className="text-right font-bold text-indigo-800">{resource.print_advice}</dd></div>}
            <div className="flex justify-between gap-4"><dt className="text-neutral-600">{t("format")}</dt><dd className="text-right font-bold text-indigo-800">{resource.format || resource.kind}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`/api/download/${resource.id}`} className="inline-flex items-center gap-2 rounded-md bg-indigo-700 px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-indigo-800">
              {resource.kind === "folder" ? <FolderOpen className="size-4" /> : <Download className="size-4" />}
              {resource.kind === "folder" ? t("openDir") : t("download")}
            </a>
            {resource.kind !== "folder" && (
              <a href={fileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-4 py-2.5 text-[13px] font-extrabold text-indigo-800 hover:bg-indigo-100">
                <Eye className="size-4" />
                {t("preview")}
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
