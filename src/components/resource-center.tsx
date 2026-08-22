"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Eye, FolderOpen, Package, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { RESOURCE_CATS } from "@/lib/data";
import type { ResourceRow } from "@/lib/db";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assets";

/** 资源卡片数据（服务端从 resources 表查出后传入） */
export type ResourceItem = Pick<
  ResourceRow,
  "id" | "title" | "category" | "kind" | "dimensions" | "print_advice" | "file_key" | "preview"
>;

export function ResourceCenter({
  items,
  initialQuery = "",
  initialCategory = "全部",
  initialSort = "default",
}: {
  items: ResourceItem[];
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: string;
}) {
  const t = useTranslations("resources");
  const categoryLabels = t.raw("categories") as string[];
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const catParam = sp.get("cat") ?? initialCategory;
  const cat = RESOURCE_CATS.includes(catParam) ? catParam : "全部";
  const sortParam = sp.get("sort") ?? initialSort;
  const sort = sortParam === "recent" || sortParam === "name" ? sortParam : "default";

  useEffect(() => {
    const syncQuery = () => setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    window.addEventListener("popstate", syncQuery);
    return () => window.removeEventListener("popstate", syncQuery);
  }, []);

  const updateUrl = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || (key === "cat" && value === "全部") || (key === "sort" && value === "default")) next.delete(key);
      else next.set(key, value);
    });
    const search = next.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateUrl({ q: query.trim() || null });
  };

  const clearFilters = () => {
    setQuery("");
    router.push(pathname, { scroll: false });
  };

  const list = items;

  return (
    <section className="mx-auto max-w-[1200px] px-7 py-8.5">
      <form onSubmit={submitSearch} role="search" className="mt-1 flex flex-col gap-3 rounded-[14px] border border-[#E4EAF7] bg-card p-3.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtext" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="h-10 w-full rounded-[10px] border border-[#DCE6F7] bg-white pr-3 pl-9 text-[13px] text-navy outline-none placeholder:text-subtext focus:border-cyan-print"
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] font-bold text-subtext">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("sort")}</span>
          <select
            value={sort}
            onChange={(event) => updateUrl({ sort: event.target.value })}
            className="h-10 rounded-[10px] border border-[#DCE6F7] bg-white px-3 text-[12px] font-bold text-navy outline-none focus:border-cyan-print"
          >
            <option value="default">{t("sortDefault")}</option>
            <option value="recent">{t("sortRecent")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        </label>
        {(query || cat !== "全部" || sort !== "default") && (
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[12px] font-extrabold text-subtext hover:bg-[#F0F5FC] hover:text-navy">
            <X aria-hidden="true" className="size-4" />
            {t("clearFilters")}
          </button>
        )}
      </form>

      <div className="mt-4 mb-5.5 flex flex-wrap items-center gap-2">
        {RESOURCE_CATS.map((c, index) => (
          <button
            key={c}
            type="button"
            onClick={() => updateUrl({ cat: c === "全部" ? null : c })}
            aria-pressed={cat === c}
            className={cn(
              "rounded-full border border-[#DCE6F7] bg-card px-4 py-2 text-[13px] font-bold tracking-wide text-subtext transition-colors",
              cat === c && "border-navy bg-navy text-white"
            )}
          >
            {categoryLabels[index] ?? (c === "全部" ? t("all") : c)}
          </button>
        ))}
        <span className="ml-auto text-[12px] font-bold text-subtext">{t("resultCount", { count: list.length })}</span>
        {cat !== "全部" && (
          <a
            href={`/api/download/category/${encodeURIComponent(cat)}`}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-[#24348A]"
          >
            <Package className="size-4" />
            {t("zipCat")} ({categoryLabels[RESOURCE_CATS.indexOf(cat)] ?? cat})
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <div
            key={r.id}
            className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
          >
            <Link href={`/resources/${r.id}`} aria-label={t("openDetail", { title: r.title })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(r.preview || "/assets/img/mkt-hero-poster.png")}
                alt={r.title}
                className="aspect-[16/10] w-full bg-deep object-cover"
              />
            </Link>
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
                      href={assetUrl(`/${r.file_key.replace(/^\//, "")}`)}
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
      {list.length === 0 && (
        <div className="mt-5 rounded-[14px] border border-dashed border-[#B9CFEE] bg-card px-6 py-14 text-center">
          <div className="text-[16px] font-extrabold text-navy">{t("emptyTitle")}</div>
          <p className="mt-1.5 text-[13px] text-subtext">{t("emptySub")}</p>
          <button type="button" onClick={clearFilters} className="mt-4 rounded-[10px] bg-navy px-4 py-2.5 text-[12px] font-extrabold text-white">
            {t("clearFilters")}
          </button>
        </div>
      )}
    </section>
  );
}
