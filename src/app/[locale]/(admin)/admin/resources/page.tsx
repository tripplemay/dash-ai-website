import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { listAllResourcesPage } from "@/lib/db";
import { UploadForm, ResourceRow } from "@/components/admin/resources-client";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("admin.resources");
  const params = (await searchParams) ?? {};
  const rawCursor = params.cursor;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;
  const page = listAllResourcesPage({ cursor });

  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[2px]">{t("title")}</h1>
      <div className="mt-1.5 mb-5 text-[13.5px] text-muted-foreground">{t("sub")}</div>

      <UploadForm />

      <div className="mt-5 overflow-x-auto rounded-lg border border-neutral-200 bg-card shadow-card">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 text-[12px] tracking-wider text-muted-foreground">
              <th className="px-4 py-3.5 font-extrabold">{t("colPreview")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colTitle")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colCategory")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colFormat")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colPath")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colAdvice")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colSort")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colUpdated")}</th>
              <th className="px-4 py-3.5 font-extrabold">{t("colOps")}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((r) => (
              <ResourceRow key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
      {page.nextCursor && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`?cursor=${encodeURIComponent(page.nextCursor)}`}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-card px-5 py-2.5 text-[13px] font-extrabold text-indigo-800 transition-colors hover:border-coral-700 hover:text-coral-700"
          >
            {t("nextPage")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
    </>
  );
}
