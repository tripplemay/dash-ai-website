"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ResourceEntry } from "@/lib/resource-browser";
import { cn } from "@/lib/utils";

export function ResourcePreview({ entry, className }: { entry: ResourceEntry | null; className?: string }) {
  const t = useTranslations("resources");
  const [text, setText] = useState<string | null>(null);
  const [textUrl, setTextUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!entry || entry.previewKind !== "text" || !entry.previewUrl) {
      return;
    }
    const controller = new AbortController();
    fetch(entry.previewUrl, { signal: controller.signal, credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("preview failed");
        return response.text();
      })
      .then((value) => {
        setText(value);
        setTextUrl(entry.previewUrl);
        setState("idle");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTextUrl(entry.previewUrl);
        setState("error");
      });
    return () => controller.abort();
  }, [entry]);

  if (!entry) {
    return <div className={cn("flex min-h-[360px] items-center justify-center bg-neutral-50 p-8 text-center text-sm text-muted-foreground", className)}>{t("selectFile")}</div>;
  }
  if (entry.previewKind !== "download" && !entry.previewUrl) {
    return <PreviewFallback entry={entry} message={t("previewFailed")} />;
  }

  if (entry.previewKind === "image" || entry.previewKind === "svg") {
    return (
      <PreviewChrome entry={entry} className={className}>
        <div className="flex min-h-[360px] items-center justify-center overflow-auto bg-neutral-50 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.previewUrl || ""} alt={entry.name} className="max-h-[min(72vh,680px)] max-w-full object-contain" />
        </div>
      </PreviewChrome>
    );
  }
  if (entry.previewKind === "pdf") {
    return <PreviewChrome entry={entry} className={className}><iframe title={entry.name} src={entry.previewUrl || ""} className="min-h-[360px] w-full bg-neutral-50" /></PreviewChrome>;
  }
  if (entry.previewKind === "audio") {
    return <PreviewChrome entry={entry} className={className}><div className="flex min-h-[360px] items-center justify-center bg-neutral-50 p-8"><audio controls className="w-full max-w-xl" src={entry.previewUrl || ""} /></div></PreviewChrome>;
  }
  if (entry.previewKind === "video") {
    return <PreviewChrome entry={entry} className={className}><div className="flex min-h-[360px] items-center justify-center bg-neutral-950 p-4"><video controls className="max-h-[min(72vh,680px)] max-w-full" src={entry.previewUrl || ""} /></div></PreviewChrome>;
  }
  if (entry.previewKind === "text") {
    if (state === "loading" || textUrl !== entry.previewUrl) return <PreviewChrome entry={entry} className={className}><div className="flex min-h-[360px] items-center justify-center bg-neutral-50"><LoaderCircle className="size-5 animate-spin text-coral-700" aria-label={t("loading")} /></div></PreviewChrome>;
    if (state === "error") return <PreviewFallback entry={entry} message={t("previewFailed")} />;
    return <PreviewChrome entry={entry} className={className}><pre className="min-h-[360px] max-h-[min(72vh,680px)] overflow-auto whitespace-pre-wrap break-words bg-neutral-950 p-5 text-left font-mono text-xs leading-relaxed text-neutral-100">{text}</pre></PreviewChrome>;
  }
  return <PreviewFallback entry={entry} message={t("unsupportedPreview")} />;
}

function PreviewChrome({ entry, className, children }: { entry: ResourceEntry; className?: string; children: React.ReactNode }) {
  const t = useTranslations("resources");
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
        <span className="min-w-0 truncate text-[12px] font-extrabold text-indigo-800" title={entry.name}>{entry.name}</span>
        {entry.downloadUrl && <a href={entry.downloadUrl} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-2 text-[12px] font-extrabold text-white hover:bg-indigo-800"><Download className="size-3.5" aria-hidden="true" />{t("downloadCurrent")}</a>}
      </div>
      {children}
    </div>
  );
}

function PreviewFallback({ entry, message }: { entry: ResourceEntry; message: string }) {
  const t = useTranslations("resources");
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 bg-neutral-50 p-8 text-center">
      <AlertTriangle className="size-7 text-coral-700" aria-hidden="true" />
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={entry.downloadUrl || "#"} className="inline-flex items-center gap-2 rounded-md bg-indigo-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-800">
          <Download className="size-4" aria-hidden="true" />{t("downloadFile")}
        </a>
        {entry.previewUrl && (
          <a href={entry.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-extrabold text-indigo-800 ring-1 ring-neutral-200 hover:bg-indigo-50">
            <ExternalLink className="size-4" aria-hidden="true" />{t("openOriginal")}
          </a>
        )}
      </div>
      <FileText className="size-5 text-neutral-400" aria-hidden="true" />
    </div>
  );
}
