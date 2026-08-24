import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { listContentEntries, type ContentStatus } from "@/lib/content";
import { ContentCreateForm, ContentEntryRow } from "@/components/admin/content-client";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "review", "published", "archived"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("admin.content");
  const params = (await searchParams) ?? {};
  const statusParam = firstParam(params.status);
  const type = firstParam(params.type) || undefined;
  const locale = firstParam(params.locale) || undefined;
  const query = firstParam(params.query) || undefined;
  const cursor = firstParam(params.cursor) || undefined;
  const status = statusParam && STATUSES.includes(statusParam as (typeof STATUSES)[number])
    ? (statusParam as ContentStatus)
    : undefined;
  const safeType = type && /^[a-z][a-z0-9._-]{0,63}$/.test(type) ? type : undefined;
  const safeLocale = locale && /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?$/.test(locale) ? locale : undefined;
  const page = listContentEntries({ status, type: safeType, locale: safeLocale, query, cursor, limit: 40 });

  const filterHref = (key: string, value?: string) => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (type) next.set("type", type);
    if (locale) next.set("locale", locale);
    if (key !== "status" && status) next.set("status", status);
    if (value) next.set(key, value);
    const encoded = next.toString();
    return encoded ? `?${encoded}` : "?";
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[2px]">{t("title")}</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">{t("sub")}</p>
        </div>
        <span className="text-[12px] font-bold text-muted-foreground">{page.items.length} / 40</span>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <form className="flex min-w-0 flex-1 gap-2" method="get">
          <input name="query" defaultValue={query} placeholder={t("slug")} className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-coral-500" />
          <select name="status" defaultValue={status || ""} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="">{t("allStatuses")}</option>
            {STATUSES.map((value) => <option key={value} value={value}>{t(value)}</option>)}
          </select>
          <select name="type" defaultValue={type || ""} className="hidden h-9 rounded-lg border border-input bg-transparent px-2 text-sm sm:block">
            <option value="">{t("allTypes")}</option>
            {[
              ["course", "course"], ["lesson", "lesson"], ["faq", "faq"], ["brand-guideline", "brand-guideline"],
              ["presentation", "presentation"], ["work", "work"], ["badge-definition", "badge-definition"],
            ].map(([value, label]) => <option key={value} value={value}>{t(`typeOptions.${label}` as never)}</option>)}
          </select>
          <button type="submit" className="h-9 rounded-md bg-indigo-800 px-3 text-[12px] font-extrabold text-white hover:bg-indigo-700">{t("load")}</button>
        </form>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Link href={filterHref("status")} className="hover:text-coral-700">{t("allStatuses")}</Link>
          <span aria-hidden="true">·</span>
          <Link href={filterHref("locale", "zh")} className="hover:text-coral-700">zh</Link>
          <Link href={filterHref("locale", "en")} className="hover:text-coral-700">en</Link>
        </div>
      </div>

      <div className="mt-5">
        <ContentCreateForm />
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-neutral-200 bg-card shadow-card">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 text-[12px] tracking-wider text-muted-foreground">
              <th className="px-4 py-3.5 font-extrabold">{t("slug")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("locale")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("allStatuses")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("revision")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("updated")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("load")}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((row) => <ContentEntryRow key={row.id} row={row} />)}
          </tbody>
        </table>
        {page.items.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>}
      </div>

      {page.nextCursor && (
        <div className="mt-6 flex justify-center">
          <Link href={`?${new URLSearchParams({ ...(query ? { query } : {}), ...(status ? { status } : {}), ...(type ? { type } : {}), ...(locale ? { locale } : {}), cursor: page.nextCursor }).toString()}`} className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-card px-5 py-2.5 text-[13px] font-extrabold text-indigo-800 transition-colors hover:border-coral-700 hover:text-coral-700">
            {t("nextPage")}<ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
    </>
  );
}
