"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, ChevronRight, File, FileArchive, FileAudio, FileImage, FileText, FileVideo, Folder, LoaderCircle, PackageOpen, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { ResourceDirectoryListing, ResourceEntry } from "@/lib/resource-browser";
import { formatResourceBytes } from "@/lib/resource-types";
import { cn } from "@/lib/utils";
import { ResourcePreview } from "@/components/resource-preview";

export function ResourceFolderViewer({
  resourceId,
  resourceTitle,
  initialListing,
}: {
  resourceId: number;
  resourceTitle: string;
  initialListing: ResourceDirectoryListing;
}) {
  const t = useTranslations("resources");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const initialFile = searchParams.get("file");
  const [listing, setListing] = useState(initialListing);
  const [selectedPath, setSelectedPath] = useState<string | null>(() => initialFile && initialListing.entries.some((entry) => entry.kind === "file" && entry.relativePath === initialFile) ? initialFile : firstPreviewable(initialListing.entries)?.relativePath || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [batchState, setBatchState] = useState<"idle" | "loading" | "error">("idle");

  const selected = listing.entries.find((entry) => entry.kind === "file" && entry.relativePath === selectedPath) || null;
  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return listing.entries;
    return listing.entries.filter((entry) => entry.name.toLocaleLowerCase().includes(normalized));
  }, [listing.entries, query]);
  const visibleFiles = visibleEntries.filter((entry) => entry.kind === "file");
  const selectedVisibleCount = visibleFiles.filter((entry) => selectedPaths.has(entry.relativePath)).length;

  const updateUrl = (pathValue: string, fileValue: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (pathValue) next.set("path", pathValue); else next.delete("path");
    if (fileValue) next.set("file", fileValue); else next.delete("file");
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const loadDirectory = async (nextPath: string, nextFile: string | null = null) => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/resources/${resourceId}/entries${nextPath ? `?path=${encodeURIComponent(nextPath)}` : ""}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("directory failed");
      const nextListing = (await response.json()) as ResourceDirectoryListing;
      const chosen = nextFile && nextListing.entries.some((entry) => entry.kind === "file" && entry.relativePath === nextFile)
        ? nextFile
        : firstPreviewable(nextListing.entries)?.relativePath || nextListing.entries.find((entry) => entry.kind === "file")?.relativePath || null;
      setListing(nextListing);
      setSelectedPath(chosen);
      updateUrl(nextListing.path, chosen);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const requestedPath = searchParams.get("path") || "";
    if (requestedPath && requestedPath !== initialListing.path) {
      const timer = window.setTimeout(() => void loadDirectory(requestedPath, searchParams.get("file")), 0);
      return () => window.clearTimeout(timer);
    }
    // Only restore a deep link once on mount; subsequent URL changes are made by this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFile = (entry: ResourceEntry) => {
    setSelectedPath(entry.relativePath);
    updateUrl(listing.path, entry.relativePath);
  };

  const toggleSelected = (entry: ResourceEntry) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(entry.relativePath)) next.delete(entry.relativePath);
      else next.add(entry.relativePath);
      return next;
    });
  };

  const toggleVisibleFiles = () => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (selectedVisibleCount === visibleFiles.length) visibleFiles.forEach((entry) => next.delete(entry.relativePath));
      else visibleFiles.forEach((entry) => next.add(entry.relativePath));
      return next;
    });
  };

  const clearSelected = () => setSelectedPaths(new Set());

  const downloadSelected = async () => {
    if (selectedPaths.size === 0) return;
    setBatchState("loading");
    try {
      const response = await fetch(`/api/download/${resourceId}/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ paths: Array.from(selectedPaths) }),
      });
      if (!response.ok) throw new Error("selection archive failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${resourceTitle}-selected.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBatchState("idle");
    } catch {
      setBatchState("error");
    }
  };

  const breadcrumbs = listing.path ? listing.path.split("/") : [];
  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1 text-[12px] font-bold text-muted-foreground">
            <button type="button" onClick={() => void loadDirectory("")} className="hover:text-coral-700">{resourceTitle}</button>
            {breadcrumbs.map((crumb, index) => {
              const crumbPath = breadcrumbs.slice(0, index + 1).join("/");
              return <span key={crumbPath} className="inline-flex items-center gap-1"><ChevronRight className="size-3" aria-hidden="true" /><button type="button" onClick={() => void loadDirectory(crumbPath)} className="max-w-[180px] truncate hover:text-coral-700">{crumb}</button></span>;
            })}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">{t("fileCount", { count: listing.entries.length })}</div>
        </div>
        <div className="relative w-full sm:max-w-[250px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchFiles")} className="h-9 w-full rounded-md border border-neutral-200 bg-white pr-3 pl-9 text-[12px] outline-none focus:border-coral-700" />
        </div>
      </div>
      {selectedPaths.size > 0 && (
        <div className="flex flex-col gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[12px] font-extrabold text-indigo-800">
            <CheckSquare className="size-4" aria-hidden="true" />
            {t("selectedCount", { count: selectedPaths.size })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {visibleFiles.length > 0 && <button type="button" onClick={toggleVisibleFiles} aria-pressed={selectedVisibleCount === visibleFiles.length} className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-[12px] font-extrabold text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100"><CheckSquare className="size-3.5" aria-hidden="true" />{selectedVisibleCount === visibleFiles.length ? t("clearVisibleSelection") : t("selectAllVisible")}</button>}
            <button type="button" onClick={clearSelected} className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-[12px] font-extrabold text-muted-foreground ring-1 ring-neutral-200 hover:bg-neutral-100"><X className="size-3.5" aria-hidden="true" />{t("clearSelection")}</button>
            <button type="button" onClick={() => void downloadSelected()} disabled={batchState === "loading"} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-2 text-[12px] font-extrabold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60"><PackageOpen className="size-3.5" aria-hidden="true" />{batchState === "loading" ? t("downloadPreparing") : t("downloadSelected")}</button>
          </div>
        </div>
      )}
      {batchState === "error" && <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{t("selectedDownloadFailed")}</div>}
      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{t("directoryLoadFailed")}</div>}
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <div className="min-w-0 border-b border-neutral-200 p-4 lg:border-r lg:border-b-0">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-coral-700" aria-label={t("loading")} /></div>
          ) : visibleEntries.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">{query ? t("noFiles") : t("emptyFolder")}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleEntries.map((entry) => entry.kind === "directory" ? (
                <button key={entry.relativePath} type="button" onClick={() => void loadDirectory(entry.relativePath)} className="group flex min-h-[112px] flex-col items-start justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50">
                  <Folder className="size-7 text-coral-700" aria-hidden="true" />
                  <span className="w-full truncate text-[12px] font-extrabold text-indigo-800">{entry.name}</span>
                  <span className="text-[10px] text-muted-foreground">{t("directory")}</span>
                </button>
              ) : (
                <div key={entry.relativePath} className={cn("relative min-h-[112px] overflow-hidden rounded-md border transition-colors", selectedPath === entry.relativePath || selectedPaths.has(entry.relativePath) ? "border-coral-700 bg-coral-50 ring-1 ring-coral-700" : "border-neutral-200 bg-white hover:border-indigo-300 hover:bg-indigo-50")}>
                  <button type="button" onClick={() => selectFile(entry)} aria-pressed={selectedPath === entry.relativePath} className="flex min-h-[112px] w-full flex-col items-start justify-between p-3 pr-11 text-left">
                    <FileIcon entry={entry} />
                    <span className="w-full truncate text-[12px] font-extrabold text-indigo-800">{entry.name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatResourceBytes(entry.bytes) || t("file")}</span>
                  </button>
                  <label className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded bg-white/90 ring-1 ring-neutral-200" title={t("selectFileForDownload", { name: entry.name })}>
                    <input type="checkbox" checked={selectedPaths.has(entry.relativePath)} onChange={() => toggleSelected(entry)} aria-label={t("selectFileForDownload", { name: entry.name })} className="size-4 accent-indigo-700" />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 bg-white">
          <ResourcePreview entry={selected} />
        </div>
      </div>
    </section>
  );
}

function firstPreviewable(entries: ResourceEntry[]) {
  return entries.find((entry) => entry.kind === "file" && entry.previewKind !== "download");
}

function FileIcon({ entry }: { entry: ResourceEntry }) {
  const className = "size-7 text-indigo-700";
  if (entry.previewKind === "image" || entry.previewKind === "svg") return entry.previewUrl ? <div className="flex size-9 items-center justify-center overflow-hidden rounded bg-neutral-100">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={entry.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
  </div> : <FileImage className={className} aria-hidden="true" />;
  if (entry.previewKind === "audio") return <FileAudio className={className} aria-hidden="true" />;
  if (entry.previewKind === "video") return <FileVideo className={className} aria-hidden="true" />;
  if (entry.previewKind === "text" || entry.previewKind === "pdf") return <FileText className={className} aria-hidden="true" />;
  if (entry.name.toLowerCase().endsWith(".zip")) return <FileArchive className={className} aria-hidden="true" />;
  return <File className={className} aria-hidden="true" />;
}
