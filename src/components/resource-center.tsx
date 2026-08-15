"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Eye, FolderOpen } from "lucide-react";
import { RESOURCE_CATS } from "@/lib/data";
import type { ResourceRow } from "@/lib/db";
import { cn } from "@/lib/utils";

/** 资源卡片数据（服务端从 resources 表查出后传入） */
export type ResourceItem = Pick<
  ResourceRow,
  "id" | "title" | "category" | "kind" | "dimensions" | "print_advice" | "file_key" | "preview"
>;

export function ResourceCenter({ items }: { items: ResourceItem[] }) {
  const t = useTranslations("resources");
  const [cat, setCat] = useState("全部");
  const list = items.filter((r) => cat === "全部" || r.category === cat);

  return (
    <section className="mx-auto max-w-[1200px] px-7 py-8.5">
      <div className="mt-4 mb-5.5 flex flex-wrap gap-2">
        {RESOURCE_CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border border-[#DCE6F7] bg-card px-4 py-2 text-[13px] font-bold tracking-wide text-subtext transition-colors",
              cat === c && "border-navy bg-navy text-white"
            )}
          >
            {c === "全部" ? t("all") : c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <div
            key={r.id}
            className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
          >
            <a href={`/api/download/${r.id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.preview || "/assets/img/mkt-hero-poster.png"}
                alt={r.title}
                className="aspect-[16/10] w-full bg-deep object-cover"
              />
            </a>
            <div className="flex flex-1 flex-col p-[14px_16px_16px]">
              <h3 className="text-[16.5px] font-extrabold">{r.title}</h3>
              <div className="mt-1.5 text-[11.5px] leading-[1.7] text-subtext">
                {r.dimensions}
                {r.dimensions && r.print_advice ? <br /> : null}
                {r.print_advice ? (
                  <>
                    {t("suggest")}
                    {r.print_advice}
                  </>
                ) : null}
              </div>
              <div className="mt-3 flex gap-2">
                {r.kind === "folder" ? (
                  <a
                    href={`/api/download/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-navy py-2.5 text-center text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-[#24348A]"
                  >
                    <FolderOpen className="size-4" />
                    {t("openDir")}
                  </a>
                ) : (
                  <>
                    <a
                      href={`/api/download/${r.id}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-navy py-2.5 text-center text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-[#24348A]"
                    >
                      <Download className="size-4" />
                      {t("download")}
                    </a>
                    <a
                      href={`/${r.file_key.replace(/^\//, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#EEF4FE] py-2.5 text-center text-[13px] font-extrabold tracking-wider text-navy"
                    >
                      <Eye className="size-4" />
                      {t("preview")}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
