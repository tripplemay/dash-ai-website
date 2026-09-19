import { useTranslations } from "next-intl";
import { Download, ExternalLink } from "lucide-react";
import { formatFileSize, type PaperKind, type PaperMaterial, PAPER_KIND_LABEL_KEYS } from "@/lib/paper-domain";

function uniqueKinds(material: PaperMaterial): PaperKind[] {
  const kinds = new Set(material.files.map((file) => file.kind));
  return (Object.keys(PAPER_KIND_LABEL_KEYS) as PaperKind[]).filter((kind) => kinds.has(kind));
}

/** 备赛资料卡片（无 "use client"：服务端详情页与客户端资料中心共用） */
export function PaperMaterialCard({ material }: { material: PaperMaterial }) {
  const t = useTranslations("competitions");
  return (
    <li className="rounded-lg border border-neutral-200 bg-card p-[14px_16px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded bg-indigo-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white">{material.year}</span>
        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">{material.stage}</span>
        {uniqueKinds(material).map((kind) => (
          <span key={kind} className="rounded bg-coral-50 px-2 py-0.5 text-[11px] font-bold text-coral-700">
            {t(PAPER_KIND_LABEL_KEYS[kind])}
          </span>
        ))}
        {material.hasAnswer && (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{t("paperHasAnswer")}</span>
        )}
      </div>
      <h4 className="mt-2 text-[14px] leading-6 font-extrabold text-indigo-900">{material.title}</h4>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {material.files.map((file, index) =>
          file.fileKey ? (
            <a
              key={`${material.id}-file-${index}`}
              href={`/${file.fileKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12.5px] font-bold text-indigo-800 transition-colors hover:border-indigo-400"
            >
              <Download aria-hidden="true" className="size-3.5" />
              {file.format.toUpperCase()}
              {file.size ? <span className="font-normal text-neutral-500">{formatFileSize(file.size)}</span> : null}
            </a>
          ) : (
            <a
              key={`${material.id}-file-${index}`}
              href={file.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12.5px] font-bold text-indigo-800 transition-colors hover:border-indigo-400"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {t("paperViewOriginal")}
            </a>
          )
        )}
        <a
          href={material.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-bold text-neutral-400 transition-colors hover:text-indigo-700"
          title={material.source.url}
        >
          {t("paperSource")}：{material.source.name}
          <ExternalLink aria-hidden="true" className="size-3" />
        </a>
      </div>
    </li>
  );
}
