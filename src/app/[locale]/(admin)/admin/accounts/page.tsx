import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CreateAccountForm, AccountRowActions } from "@/components/admin/accounts-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-[#FFF1E8] text-orange",
  partner: "bg-[#E6FAFF] text-cyan-print",
  teacher: "bg-[#F0EDFF] text-[#7A5CFF]",
  guest: "bg-[#E8F4FF] text-[#2E7DFF]",
};

interface AdminUser {
  id: string;
  username?: string | null;
  name: string;
  role?: string | null;
  banned?: boolean | null;
  createdAt: string | Date;
}

export default async function AdminAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.accounts" });
  // AUTH_DISABLED（本地开发预览）时无会话，直接读 user 表；生产走 admin API（带权限校验）
  const users = (
    AUTH_DISABLED
      ? getDb()
          .prepare("SELECT id, username, name, role, banned, createdAt FROM user ORDER BY createdAt ASC")
          .all()
      : (
          await auth.api.listUsers({
            query: { limit: "200", sortBy: "createdAt", sortDirection: "asc" },
            headers: await headers(),
          })
        ).users
  ) as unknown as AdminUser[];

  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[2px]">{t("title")}</h1>
      <div className="mt-1.5 mb-5 text-[13.5px] text-subtext">{t("sub")}</div>

      <CreateAccountForm />

      <div className="mt-5 overflow-hidden rounded-2xl bg-card shadow-card">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#E4EAF7] text-[12px] tracking-wider text-subtext">
              <th className="px-5 py-3.5 font-extrabold">{t("colUsername")}</th>
              <th className="px-5 py-3.5 font-extrabold">{t("colName")}</th>
              <th className="px-5 py-3.5 font-extrabold">{t("colRole")}</th>
              <th className="px-5 py-3.5 font-extrabold">{t("colStatus")}</th>
              <th className="px-5 py-3.5 font-extrabold">{t("colCreated")}</th>
              <th className="px-5 py-3.5 font-extrabold">{t("colOps")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#F0F5FC] last:border-0 hover:bg-[#FAFCFF]">
                <td className="px-5 py-3 font-extrabold text-navy">{u.username || "—"}</td>
                <td className="px-5 py-3">{u.name}</td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-extrabold",
                      ROLE_STYLE[u.role || ""] || "bg-mist text-subtext"
                    )}
                  >
                    {u.role || "user"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {u.banned ? (
                    <span className="font-bold text-destructive">{t("statusBanned")}</span>
                  ) : (
                    <span className="font-bold text-[#0E9F6E]">{t("statusActive")}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-subtext">
                  {new Date(u.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en")}
                </td>
                <td className="px-5 py-3">
                  <AccountRowActions
                    userId={u.id}
                    username={u.username || u.name}
                    banned={!!u.banned}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
