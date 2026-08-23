"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createAccount, resetPassword, setAccountBanned } from "@/app/[locale]/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Ban, CircleCheck } from "lucide-react";

export function CreateAccountForm() {
  const t = useTranslations("admin.accounts");
  const router = useRouter();
  const [form, setForm] = useState({ username: "", name: "", role: "partner", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await createAccount(form);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? t("createOk") : r.error || t("createFailed") });
    if (r.ok) {
      setForm({ username: "", name: "", role: "partner", password: "" });
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-neutral-200 bg-card p-6 shadow-card">
      <h2 className="text-[16px] font-extrabold">{t("createTitle")}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>{t("colUsername")}</Label>
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="partner2"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("colName")}</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="张老师"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("colRole")}</Label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="partner">partner</option>
            <option value="teacher">teacher</option>
            <option value="guest">guest</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("colPassword")}</Label>
          <Input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={t("passwordPh")}
            required
            minLength={8}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={busy} className="font-extrabold">
          {busy ? t("submitting") : t("createSubmit")}
        </Button>
        {msg && (
          <span className={`text-[13px] font-bold ${msg.ok ? "text-coral-700" : "text-destructive"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

export function AccountRowActions({
  userId,
  username,
  banned,
}: {
  userId: string;
  username: string;
  banned: boolean;
}) {
  const t = useTranslations("admin.accounts");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const doReset = async () => {
    const pw = window.prompt(t("resetPrompt", { username }));
    if (!pw) return;
    setBusy(true);
    const r = await resetPassword(userId, pw);
    setBusy(false);
    window.alert(r.ok ? t("resetOk") : r.error || t("failed"));
  };

  const toggleBan = async () => {
    if (!window.confirm(banned ? t("unbanConfirm", { username }) : t("banConfirm", { username }))) return;
    setBusy(true);
    await setAccountBanned(userId, !banned);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={doReset}
        disabled={busy}
        title={t("reset")}
        className="flex items-center gap-1 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
      >
        <KeyRound className="size-3.5" />
        {t("reset")}
      </button>
      <button
        onClick={toggleBan}
        disabled={busy}
        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
          banned ? "bg-[#EAF8F0] text-[#17613B]" : "bg-[#FDE8E5] text-destructive"
        }`}
      >
        {banned ? <CircleCheck className="size-3.5" /> : <Ban className="size-3.5" />}
        {banned ? t("unban") : t("ban")}
      </button>
    </div>
  );
}
