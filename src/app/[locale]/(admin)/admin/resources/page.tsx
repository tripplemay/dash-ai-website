import { useTranslations } from "next-intl";
import { listAllResources } from "@/lib/db";
import { UploadForm, ResourceRow } from "@/components/admin/resources-client";

export const dynamic = "force-dynamic";

export default function AdminResourcesPage() {
  const t = useTranslations("admin.resources");
  const rows = listAllResources();

  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[2px]">{t("title")}</h1>
      <div className="mt-1.5 mb-5 text-[13.5px] text-subtext">{t("sub")}</div>

      <UploadForm />

      <div className="mt-5 overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#E4EAF7] text-[12px] tracking-wider text-subtext">
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
            {rows.map((r) => (
              <ResourceRow key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
