import type { Metadata } from "next";
import path from "node:path";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Download, FolderArchive } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getResource } from "@/lib/db";
import { RESOURCE_CATS } from "@/lib/data";
import { describeResourceFile, listResourceDirectory, type ResourceDirectoryListing } from "@/lib/resource-browser";
import { localizedResourceTitle } from "@/lib/workspace-copy";
import { ResourceFolderViewer } from "@/components/resource-folder-viewer";
import { ResourcePreview } from "@/components/resource-preview";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id, locale } = await params;
  const resource = getResource(Number(id));
  return {
    title: resource ? localizedResourceTitle(resource, locale === "en" ? "en" : "zh") : locale === "en" ? "Resource detail" : "资源详情",
  };
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const resource = getResource(Number(id));
  if (!resource || !resource.enabled) notFound();
  const t = await getTranslations({ locale, namespace: "resources" });
  const categoryLabels = t.raw("categories") as string[];
  const resourceTitle = localizedResourceTitle(resource, locale === "en" ? "en" : "zh");
  let listing: ResourceDirectoryListing | null = null;
  if (resource.kind === "folder") {
    try {
      listing = await listResourceDirectory(resource.id);
    } catch {
      listing = null;
    }
  }
  const fileEntry = resource.kind === "file" ? describeResourceFile(resource.file_key, path.basename(resource.file_key)) : null;

  return (
    <div className="w-full px-5 py-7 sm:px-7 lg:py-10">
      <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-neutral-600">
        <Link href="/resources" className="hover:text-coral-700">{t("title1")} {t("title2")}</Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-indigo-800">{resourceTitle}</span>
      </nav>
      <div className="mt-5 flex flex-col gap-3 border-b border-neutral-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-extrabold tracking-[2px] text-coral-700">{categoryLabels[RESOURCE_CATS.indexOf(resource.category)] ?? resource.category}</div>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-wide text-indigo-800">{resourceTitle}</h1>
        </div>
        <a href={`/api/download/${resource.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-indigo-700 px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-indigo-800">
          {resource.kind === "folder" ? <FolderArchive className="size-4" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          {resource.kind === "folder" ? t("downloadFolder") : t("downloadFile")}
        </a>
      </div>

      {resource.kind === "folder" && (resource.dimensions || resource.print_advice || resource.format) && (
        <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-[13px]">
          {resource.dimensions && <div className="flex gap-2"><dt className="text-neutral-600">{t("dimensions")}</dt><dd className="font-bold text-indigo-800">{resource.dimensions}</dd></div>}
          {resource.print_advice && <div className="flex gap-2"><dt className="text-neutral-600">{t("adviceLabel")}</dt><dd className="font-bold text-indigo-800">{resource.print_advice}</dd></div>}
          {resource.format && <div className="flex gap-2"><dt className="text-neutral-600">{t("format")}</dt><dd className="font-bold text-indigo-800">{resource.format}</dd></div>}
        </dl>
      )}

      {resource.kind === "folder" ? (
        listing ? <ResourceFolderViewer resourceId={resource.id} resourceTitle={resourceTitle} initialListing={listing} /> : (
          <div className="mt-6 flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 px-6 text-center text-sm text-red-800">{t("resourceUnavailable")}</div>
        )
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card">
            <ResourcePreview entry={fileEntry} />
          </div>
          <section>
            <dl className="space-y-2 rounded-lg border border-neutral-200 bg-card p-4 text-[13px]">
              {resource.dimensions && <div className="flex justify-between gap-4"><dt className="text-neutral-600">{t("dimensions")}</dt><dd className="text-right font-bold text-indigo-800">{resource.dimensions}</dd></div>}
              {resource.print_advice && <div className="flex justify-between gap-4"><dt className="text-neutral-600">{t("adviceLabel")}</dt><dd className="text-right font-bold text-indigo-800">{resource.print_advice}</dd></div>}
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">{t("format")}</dt><dd className="text-right font-bold text-indigo-800">{resource.format || resource.kind}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
