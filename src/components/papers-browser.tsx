"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PaperMaterialCard } from "@/components/paper-material-card";
import {
  groupPapersByYear,
  paperKindsPresent,
  type PaperCompetitionEntry,
  type PaperKind,
  PAPER_KIND_LABEL_KEYS,
} from "@/lib/paper-domain";
import { cn } from "@/lib/utils";

const controlClass =
  "min-h-11 rounded-md border border-neutral-200 bg-card px-3 py-2 text-[13px] font-bold text-neutral-700 transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export function PapersBrowser({ entries }: { entries: PaperCompetitionEntry[] }) {
  const t = useTranslations("competitions");
  const [query, setQuery] = useState("");
  const [competition, setCompetition] = useState<string | null>(null);
  const [kind, setKind] = useState<PaperKind | null>(null);

  const allPapers = useMemo(() => entries.flatMap((entry) => entry.papers), [entries]);
  const kinds = useMemo(() => paperKindsPresent(allPapers), [allPapers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((entry) => (competition ? entry.slug === competition : true))
      .map((entry) => ({
        ...entry,
        papers: entry.papers.filter((material) => {
          if (kind && !material.files.some((file) => file.kind === kind)) return false;
          if (q && !material.title.toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter((entry) => entry.papers.length > 0);
  }, [entries, query, competition, kind]);

  const filteredCount = filtered.reduce((sum, entry) => sum + entry.papers.length, 0);

  return (
    <section className="w-full min-w-0 px-5 py-5 sm:px-7 sm:py-7">
      <div className="rounded-xl border border-neutral-200 bg-card p-3.5 sm:p-5">
        <div className="flex min-w-0 flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <label htmlFor="papers-search" className="sr-only">
              {t("papersSearchLabel")}
            </label>
            <Search aria-hidden="true" className="absolute top-3.5 left-3 size-4 text-neutral-500" />
            <input
              id="papers-search"
              type="search"
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("papersSearchPlaceholder")}
              className={cn(controlClass, "w-full pr-3 pl-9 font-normal")}
            />
          </div>
          <label htmlFor="papers-competition" className="sr-only">
            {t("papersFilterCompetition")}
          </label>
          <select
            id="papers-competition"
            value={competition ?? ""}
            onChange={(event) => setCompetition(event.target.value || null)}
            className={cn(controlClass, "max-w-64")}
          >
            <option value="">{t("papersFilterCompetitionAll", { count: entries.length })}</option>
            {entries.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.nameZh}（{entry.papers.length}）
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <span aria-hidden="true" className="text-[13px] font-bold text-neutral-600">
            {t("papersFilterKind")}
          </span>
          <button
            type="button"
            aria-pressed={kind === null}
            onClick={() => setKind(null)}
            className={cn(controlClass, kind === null && "border-indigo-700 bg-indigo-700 text-white hover:border-indigo-700")}
          >
            {t("filterAll")}
          </button>
          {kinds.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(controlClass, kind === value && "border-indigo-700 bg-indigo-700 text-white hover:border-indigo-700")}
            >
              {t(PAPER_KIND_LABEL_KEYS[value])}
            </button>
          ))}
        </div>
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-[13px] font-bold text-neutral-600">
        {t("papersCountLabel", { competitions: filtered.length, count: filteredCount })}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-card p-8 text-center">
          <p className="text-sm text-neutral-600">{t("papersEmptyResult")}</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCompetition(null);
              setKind(null);
            }}
            className={cn(controlClass, "mt-4 text-indigo-800")}
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : (
        filtered.map((entry) => (
          <section key={entry.slug} className="mt-6">
            <h3 className="flex flex-wrap items-baseline gap-2 text-[18px] font-extrabold text-indigo-900">
              <Link href={`/competitions/${entry.slug}#papers`} className="rounded-sm hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-indigo-600">
                {entry.nameZh}
              </Link>
              <span className="text-[12px] font-bold text-neutral-400">{t("papersMaterialCount", { count: entry.papers.length })}</span>
            </h3>
            {groupPapersByYear(entry.papers).map(([year, materials]) => (
              <div key={year} className="mt-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] font-extrabold text-coral-700">{year}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-neutral-200" />
                </div>
                <ol className="mt-2 space-y-3">
                  {materials.map((material) => (
                    <PaperMaterialCard key={material.id} material={material} />
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ))
      )}
    </section>
  );
}
