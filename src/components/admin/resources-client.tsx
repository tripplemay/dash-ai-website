"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  updateResourceMeta,
  setResourceEnabled,
  deleteResource,
} from "@/app/[locale]/(app)/admin/actions";
import { RESOURCE_CATS_STORE } from "@/lib/data";
import type { ResourceRow } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { resourcePreviewUrl } from "@/lib/assets";

// ---------- 上传新资源 ----------

export function UploadForm() {
  const t = useTranslations("admin.resources");
  const categoryLabels = t.raw("categories") as string[];
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [category, setCategory] = useState(RESOURCE_CATS_STORE[0]);
  const [advice, setAdvice] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const doUpload = async (overwrite: boolean) => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg({ ok: false, text: t("needFile") });
      return false;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("title_en", titleEn);
    fd.append("category", category);
    fd.append("print_advice", advice);
    if (overwrite) fd.append("overwrite", "1");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (res.status === 409) return true; // 需确认覆盖
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: data.error || t("failed") });
      return false;
    }
    setMsg({ ok: true, text: t("uploadOk") });
    setTitle("");
    setTitleEn("");
    setAdvice("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
    return false;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const needConfirm = await doUpload(false);
    if (needConfirm && window.confirm(t("overwriteConfirm"))) {
      await doUpload(true);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-neutral-200 bg-card p-6 shadow-card">
      <h2 className="text-[16px] font-extrabold">{t("uploadTitle")}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>{t("colFile")}</Label>
          <input
            ref={fileRef}
            type="file"
            required
            className="w-full rounded-md border border-input px-2.5 py-1.5 text-sm file:mr-2 file:rounded-sm file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-xs file:font-bold file:text-indigo-800"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("colTitle")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("colTitleEn")}</Label>
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t("colCategory")}</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {RESOURCE_CATS_STORE.map((c, index) => (
              <option key={c} value={c}>
                {categoryLabels[index] ?? c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("colAdvice")}</Label>
          <Input value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder={t("advicePh")} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={busy} className="font-extrabold">
          <Upload className="size-4" />
          {busy ? t("submitting") : t("uploadSubmit")}
        </Button>
        {msg && (
          <span className={cn("text-[13px] font-bold", msg.ok ? "text-coral-700" : "text-destructive")}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

// ---------- 行操作（编辑 / 上下架 / 删除） ----------

export function ResourceRow({ row }: { row: ResourceRow }) {
  const t = useTranslations("admin.resources");
  const categoryLabels = t.raw("categories") as string[];
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: row.title,
    title_en: row.title_en || row.title,
    category: row.category,
    print_advice: row.print_advice || "",
    sort: row.sort,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await updateResourceMeta(row.id, form);
    setBusy(false);
    if (!r.ok) window.alert(r.error || t("failed"));
    else {
      setEditing(false);
      router.refresh();
    }
  };

  const toggle = async () => {
    setBusy(true);
    await setResourceEnabled(row.id, !row.enabled);
    setBusy(false);
    router.refresh();
  };

  const del = async () => {
    if (!window.confirm(t("deleteConfirm", { title: row.title }))) return;
    setBusy(true);
    await deleteResource(row.id);
    setBusy(false);
    router.refresh();
  };

  return (
    <tr className="border-b border-neutral-100 align-middle last:border-0 hover:bg-neutral-50">
      <td className="px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resourcePreviewUrl(row.preview)}
          alt=""
          width={128}
          height={80}
          loading="lazy"
          decoding="async"
          className="h-10 w-16 rounded-lg bg-reverse-background object-cover"
        />
      </td>
      <td className="min-w-[180px] px-4 py-3">
        {editing ? (
          <div className="space-y-1.5">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
          </div>
        ) : (
          <div>
            <span className="font-extrabold text-indigo-800">{row.title}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{row.title_en || row.title}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {RESOURCE_CATS_STORE.map((c, index) => (
              <option key={c} value={c}>
                {categoryLabels[index] ?? c}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">
            {categoryLabels[RESOURCE_CATS_STORE.indexOf(row.category)] ?? row.category}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{row.format || "—"}</td>
      <td className="max-w-[220px] truncate px-4 py-3 text-[12px] text-muted-foreground" title={row.file_key}>
        /{row.file_key}
      </td>
      <td className="min-w-[180px] px-4 py-3">
        {editing ? (
          <Input
            value={form.print_advice}
            onChange={(e) => setForm({ ...form, print_advice: e.target.value })}
            placeholder={t("advicePh")}
          />
        ) : (
          <span className="text-[12px] text-muted-foreground">{row.print_advice || "—"}</span>
        )}
      </td>
      <td className="w-[72px] px-4 py-3">
        {editing ? (
          <Input
            type="number"
            value={form.sort}
            onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
          />
        ) : (
          <span className="text-muted-foreground">{row.sort}</span>
        )}
      </td>
      <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted-foreground">{row.updated_at}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            disabled={busy}
            role="switch"
            aria-checked={!!row.enabled}
            className={cn(
              "relative h-5.5 w-10 rounded-full transition-colors",
              row.enabled ? "bg-green-600" : "bg-neutral-300"
            )}
            title={row.enabled ? t("disable") : t("enable")}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all",
                row.enabled ? "left-5" : "left-0.5"
              )}
            />
          </button>
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={busy}
                title={t("save")}
                className="rounded-md bg-[#EAF8F0] p-1.5 text-[#17613B]"
              >
                <Check className="size-4" />
              </button>
              <button
                onClick={() => setEditing(false)}
                title={t("cancel")}
                className="rounded-lg bg-muted p-1.5 text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              title={t("edit")}
              className="rounded-md bg-indigo-50 p-1.5 text-indigo-800"
            >
              <Pencil className="size-4" />
            </button>
          )}
          <button
            onClick={del}
            disabled={busy}
            title={t("delete")}
            className="rounded-md bg-[#FDE8E5] p-1.5 text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
