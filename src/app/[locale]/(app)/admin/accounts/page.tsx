import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CreateAccountForm, AccountRowActions } from "@/components/admin/accounts-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-orange-50 text-orange-700",
  partner: "bg-coral-50 text-coral-700",
  teacher: "bg-indigo-50 text-indigo-700",
  guest: "bg-sky-50 text-sky-700",
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
      <div className="mt-1.5 mb-5 text-[13.5px] text-muted-foreground">{t("sub")}</div>

      <CreateAccountForm />

      <div className="mt-5 overflow-x-auto rounded-lg border border-neutral-200 bg-card shadow-card">
        <table className="min-w-[720px] w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 text-[12px] tracking-wider text-muted-foreground">
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
              <tr key={u.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-5 py-3 font-extrabold text-indigo-800">{u.username || "—"}</td>
                <td className="px-5 py-3">{u.name}</td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-extrabold",
                      ROLE_STYLE[u.role || ""] || "bg-muted text-muted-foreground"
                    )}
                  >
                    {u.role || "user"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {u.banned ? (
                    <span className="font-bold text-destructive">{t("statusBanned")}</span>
                  ) : (
                    <span className="font-bold text-[#17613B]">{t("statusActive")}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-muted-foreground">
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
