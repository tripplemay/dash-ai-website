import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Download, Eye, FolderOpen } from "lucide-react";
import { getResource } from "@/lib/db";
import { assetUrl } from "@/lib/assets";
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
  const fileHref = assetUrl(`/${resource.file_key.replace(/^\/+/, "")}`);

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-7 sm:px-7 lg:py-10">
      <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-subtext">
        <Link href="/resources" className="hover:text-cyan-print">{t("title1")} {t("title2")}</Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-navy">{resource.title}</span>
      </nav>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-[14px] border border-[#E4EAF7] bg-card shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(resource.preview || "/assets/img/mkt-hero-poster.png")} alt="" className="aspect-[16/10] w-full bg-deep object-cover" />
        </div>
        <section>
          <div className="text-[11px] font-extrabold tracking-[2px] text-cyan-print">
            {categoryLabels[RESOURCE_CATS.indexOf(resource.category)] ?? resource.category}
          </div>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-wide text-navy">{resource.title}</h1>
          <dl className="mt-5 space-y-2 rounded-[12px] border border-[#E4EAF7] bg-card p-4 text-[13px]">
            {resource.dimensions && <div className="flex justify-between gap-4"><dt className="text-subtext">{t("dimensions")}</dt><dd className="text-right font-bold text-navy">{resource.dimensions}</dd></div>}
            {resource.print_advice && <div className="flex justify-between gap-4"><dt className="text-subtext">{t("adviceLabel")}</dt><dd className="text-right font-bold text-navy">{resource.print_advice}</dd></div>}
            <div className="flex justify-between gap-4"><dt className="text-subtext">{t("format")}</dt><dd className="text-right font-bold text-navy">{resource.format || resource.kind}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`/api/download/${resource.id}`} className="inline-flex items-center gap-2 rounded-[10px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-[#24348A]">
              {resource.kind === "folder" ? <FolderOpen className="size-4" /> : <Download className="size-4" />}
              {resource.kind === "folder" ? t("openDir") : t("download")}
            </a>
            {resource.kind !== "folder" && (
              <a href={fileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-[10px] bg-[#EEF4FE] px-4 py-2.5 text-[13px] font-extrabold text-navy hover:bg-[#E1EBFA]">
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
