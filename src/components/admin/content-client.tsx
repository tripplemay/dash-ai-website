"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Check, FileJson, Pencil, RotateCcw, Send, X } from "lucide-react";
import type { ContentEntryDTO, ContentEntryDetail, ContentStatus, JsonValue } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CONTENT_TYPES = ["course", "lesson", "faq", "brand-guideline", "presentation", "work", "badge-definition"] as const;

function statusTone(status: ContentStatus) {
  if (status === "published") return "bg-[#EAF8F0] text-[#17613B]";
  if (status === "review") return "bg-orange-50 text-orange-700";
  if (status === "archived") return "bg-neutral-100 text-neutral-500";
  return "bg-indigo-50 text-indigo-800";
}

function messageFromResponse(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  return fallback;
}

export function ContentCreateForm() {
  const t = useTranslations("admin.content");
  const router = useRouter();
  const [type, setType] = useState<(typeof CONTENT_TYPES)[number]>("course");
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState("zh");
  const [payload, setPayload] = useState("{}\n");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(payload) as JsonValue;
    } catch {
      setMessage({ ok: false, text: t("invalidJson") });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, slug, locale, payload: parsed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ok: false, text: messageFromResponse(data, t("operationFailed")) });
        return;
      }
      setMessage({ ok: true, text: t("created") });
      setSlug("");
      setPayload("{}\n");
      router.refresh();
    } catch {
      setMessage({ ok: false, text: t("operationFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-neutral-200 bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-extrabold">{t("createTitle")}</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("sub")}</p>
        </div>
        <FileJson aria-hidden="true" className="size-5 text-coral-700" />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="content-type">{t("type")}</Label>
          <select
            id="content-type"
            value={type}
            onChange={(event) => setType(event.target.value as (typeof CONTENT_TYPES)[number])}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {CONTENT_TYPES.map((option) => (
              <option key={option} value={option}>{t(`typeOptions.${option}` as never)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="content-slug">{t("slug")}</Label>
          <Input id="content-slug" value={slug} onChange={(event) => setSlug(event.target.value)} required pattern="[a-z0-9][a-z0-9._-]*" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="content-locale">{t("locale")}</Label>
          <select id="content-locale" value={locale} onChange={(event) => setLocale(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="zh">zh</option>
            <option value="en">en</option>
          </select>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="content-payload">{t("payload")}</Label>
        <textarea
          id="content-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          spellCheck={false}
          className="min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[12px] leading-5 outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-500/20"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="font-extrabold">
          <Send aria-hidden="true" className="size-4" />
          {busy ? t("creating") : t("create")}
        </Button>
        {message && <span className={cn("text-[13px] font-bold", message.ok ? "text-[#17613B]" : "text-destructive")}>{message.text}</span>}
      </div>
    </form>
  );
}

export function ContentEntryRow({ row }: { row: ContentEntryDTO }) {
  const t = useTranslations("admin.content");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState("{}\n");
  const [detail, setDetail] = useState<ContentEntryDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/content/${encodeURIComponent(row.id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.data) throw new Error(messageFromResponse(data, t("operationFailed")));
      const next = data.data as ContentEntryDetail;
      setDetail(next);
      setPayload(JSON.stringify(next.latestRevision?.payload ?? {}, null, 2));
      setEditing(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!detail) return;
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(payload) as JsonValue;
    } catch {
      setMessage(t("invalidJson"));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/content/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsed, expectedRevision: detail.revision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFromResponse(data, t("operationFailed")));
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const transition = async (status: ContentStatus) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/content/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFromResponse(data, t("operationFailed")));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = t(`typeOptions.${row.type}` as never);
  return (
    <>
      <tr className="border-b border-neutral-100 align-top last:border-0 hover:bg-neutral-50">
        <td className="px-4 py-3">
          <div className="font-extrabold text-indigo-800">{row.slug}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{typeLabel}</div>
        </td>
        <td className="px-4 py-3 text-[12px] font-bold text-muted-foreground">{row.locale}</td>
        <td className="px-4 py-3"><span className={cn("inline-flex rounded-md px-2.5 py-1 text-[11px] font-extrabold", statusTone(row.status))}>{t(row.status)}</span></td>
        <td className="px-4 py-3 text-[12px] text-muted-foreground">v{row.revision}</td>
        <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{row.updatedAt}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={load} disabled={busy} title={t("load")} className="rounded-md bg-indigo-50 p-1.5 text-indigo-800 hover:bg-indigo-100">
              <Pencil aria-hidden="true" className="size-4" />
            </button>
            {row.status === "draft" && <button type="button" onClick={() => transition("review")} disabled={busy} title={t("submitReview")} className="rounded-md bg-orange-50 p-1.5 text-orange-700 hover:bg-orange-100"><Send aria-hidden="true" className="size-4" /></button>}
            {row.status === "review" && <button type="button" onClick={() => transition("published")} disabled={busy} title={t("publish")} className="rounded-md bg-[#EAF8F0] p-1.5 text-[#17613B] hover:bg-[#d9f2e4]"><Check aria-hidden="true" className="size-4" /></button>}
            {row.status === "published" && <button type="button" onClick={() => transition("archived")} disabled={busy} title={t("archive")} className="rounded-md bg-neutral-100 p-1.5 text-neutral-600 hover:bg-neutral-200"><X aria-hidden="true" className="size-4" /></button>}
            {row.status === "archived" && <button type="button" onClick={() => transition("draft")} disabled={busy} title={t("draft")} className="rounded-md bg-indigo-50 p-1.5 text-indigo-800 hover:bg-indigo-100"><RotateCcw aria-hidden="true" className="size-4" /></button>}
          </div>
          {message && <p className="mt-1 max-w-48 text-[11px] font-bold text-destructive">{message}</p>}
        </td>
      </tr>
      {editing && detail && (
        <tr className="border-b border-neutral-100 bg-neutral-50">
          <td colSpan={6} className="px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <textarea value={payload} onChange={(event) => setPayload(event.target.value)} spellCheck={false} className="min-h-40 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 font-mono text-[12px] leading-5 outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-500/20" />
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <button type="button" onClick={save} disabled={busy} title={t("save")} className="rounded-md bg-[#EAF8F0] p-2 text-[#17613B] hover:bg-[#d9f2e4]"><Check aria-hidden="true" className="size-4" /></button>
                <button type="button" onClick={() => setEditing(false)} disabled={busy} title={t("cancel")} className="rounded-md bg-white p-2 text-muted-foreground hover:bg-neutral-100"><X aria-hidden="true" className="size-4" /></button>
              </div>
            </div>
            {detail.audits.length > 0 && (
              <details className="mt-4 rounded-md border border-neutral-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-[12px] font-extrabold text-indigo-800">
                  {t("audit")} ({detail.audits.length})
                </summary>
                <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                  {detail.audits.slice(0, 8).map((audit) => (
                    <li key={audit.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-neutral-700">{audit.action}</span>
                      <span>{audit.createdAt}</span>
                      {audit.actorId && <span>{audit.actorId}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
