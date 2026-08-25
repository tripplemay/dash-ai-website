"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Download, Eye, Package, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { RESOURCE_CATS, RESOURCE_CATEGORIES, resolveResourceCategory } from "@/lib/data";
import type { ResourceRow } from "@/lib/db";
import { cn } from "@/lib/utils";
import { resourcePreviewUrl } from "@/lib/assets";
import { localizedResourceTitle } from "@/lib/workspace-copy";

/** 资源卡片数据（服务端从 resources 表查出后传入） */
export type ResourceItem = Pick<
  ResourceRow,
  "id" | "title" | "title_en" | "category" | "kind" | "dimensions" | "print_advice" | "file_key" | "preview"
>;

export function ResourceCenter({
  items,
  nextCursor = null,
  initialQuery = "",
  initialCategory = "全部",
  initialSort = "default",
}: {
  items: ResourceItem[];
  nextCursor?: string | null;
  initialQuery?: string;
  initialCategory?: string;
  initialSort?: string;
}) {
  const t = useTranslations("resources");
  const locale = useLocale() === "en" ? "en" : "zh";
  const categoryLabels = t.raw("categories") as string[];
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryParam = sp.get("q") ?? initialQuery;
  const [queryDraft, setQueryDraft] = useState({ source: queryParam, value: queryParam });
  // A router navigation replaces the source value during render; local edits
  // remain independent until the next URL update.
  const query = queryDraft.source === queryParam ? queryDraft.value : queryParam;
  const setQuery = (value: string) => setQueryDraft({ source: queryParam, value });
  const catParam = sp.get("cat") ?? initialCategory;
  const resolvedCategory = resolveResourceCategory(catParam);
  const cat = resolvedCategory?.label ?? "全部";
  const sortParam = sp.get("sort") ?? initialSort;
  const sort = sortParam === "recent" || sortParam === "name" ? sortParam : "default";

  const updateUrl = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    if (!("cursor" in updates)) next.delete("cursor");
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
    <section className="w-full px-7 py-8.5">
      <form onSubmit={submitSearch} role="search" className="mt-1 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-card p-3.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="h-10 w-full rounded-md border border-neutral-200 bg-white pr-3 pl-9 text-[13px] text-indigo-800 outline-none placeholder:text-muted-foreground focus:border-coral-700"
          />
        </div>
        <label className="flex items-center gap-2 text-[12px] font-bold text-muted-foreground">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("sort")}</span>
          <select
            value={sort}
            onChange={(event) => updateUrl({ sort: event.target.value })}
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-[12px] font-bold text-indigo-800 outline-none focus:border-coral-700"
          >
            <option value="default">{t("sortDefault")}</option>
            <option value="recent">{t("sortRecent")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        </label>
        {(query || cat !== "全部" || sort !== "default") && (
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-extrabold text-muted-foreground hover:bg-indigo-50 hover:text-indigo-800">
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
            onClick={() => updateUrl({ cat: c === "全部" ? null : RESOURCE_CATEGORIES[index - 1]?.key || null })}
            aria-pressed={cat === c}
            className={cn(
              "rounded-md border border-neutral-200 bg-card px-4 py-2 text-[13px] font-bold tracking-wide text-muted-foreground transition-colors",
              cat === c && "border-indigo-700 bg-indigo-700 text-white"
            )}
          >
            {categoryLabels[index] ?? (c === "全部" ? t("all") : c)}
          </button>
        ))}
        <span className="ml-auto text-[12px] font-bold text-muted-foreground">{t("resultCount", { count: list.length })}</span>
        {cat !== "全部" && (
          <a
            href={`/api/download/category/${encodeURIComponent(resolvedCategory?.key || cat)}`}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-indigo-700 px-4 py-2 text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-indigo-800"
          >
            <Package className="size-4" />
            {t("zipCat")} ({categoryLabels[RESOURCE_CATS.indexOf(cat)] ?? cat})
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((r) => (
          <div
            key={r.id}
            className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
          >
            <Link href={`/resources/${r.id}`} aria-label={t("openDetail", { title: localizedResourceTitle(r, locale) })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resourcePreviewUrl(r.preview)}
                alt={localizedResourceTitle(r, locale)}
                width={640}
                height={400}
                loading="lazy"
                decoding="async"
                className="aspect-[16/10] w-full bg-reverse-background object-cover"
              />
            </Link>
            <div className="flex flex-1 flex-col p-[14px_16px_16px]">
              <h3 className="text-[16.5px] font-extrabold">{localizedResourceTitle(r, locale)}</h3>
              <div className="mt-1.5 text-[11.5px] leading-[1.7] text-muted-foreground">
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
                <Link href={`/resources/${r.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-700 py-2.5 text-center text-[13px] font-extrabold tracking-wider text-white transition-colors hover:bg-indigo-800">
                  <Eye className="size-4" aria-hidden="true" />
                  {r.kind === "folder" ? t("browse") : t("preview")}
                </Link>
                <a href={`/api/download/${r.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-50 py-2.5 text-center text-[13px] font-extrabold tracking-wider text-indigo-800 hover:bg-indigo-100">
                  <Download className="size-4" aria-hidden="true" />
                  {r.kind === "folder" ? t("downloadFolder") : t("download")}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-indigo-200 bg-card px-6 py-14 text-center">
          <div className="text-[16px] font-extrabold text-indigo-800">{t("emptyTitle")}</div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{t("emptySub")}</p>
          <button type="button" onClick={clearFilters} className="mt-4 rounded-md bg-indigo-700 px-4 py-2.5 text-[12px] font-extrabold text-white">
            {t("clearFilters")}
          </button>
        </div>
      )}
      {nextCursor && (
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => updateUrl({ cursor: nextCursor })}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-card px-5 py-2.5 text-[13px] font-extrabold text-indigo-800 transition-colors hover:border-coral-700 hover:text-coral-700"
          >
            {t("nextPage")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </section>
  );
}
