"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ListTree } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  BRAND_MANUAL_ACTIVE_EVENT,
  BRAND_MANUAL_EMBED_URL,
  BRAND_MANUAL_NAVIGATE_EVENT,
  BRAND_MANUAL_SECTIONS,
  isBrandManualSectionId,
  type BrandManualSectionId,
} from "@/lib/brand-manual";

const MANUAL_MESSAGE_VERSION = 1;

function sectionFromHash() {
  if (typeof window === "undefined") return null;
  let value = window.location.hash.replace(/^#/, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  return isBrandManualSectionId(value) ? value : null;
}

function setManualHash(id: BrandManualSectionId, mode: "push" | "replace" = "replace") {
  const hash = id === "cover" ? "" : `#${id}`;
  const next = `${window.location.pathname}${window.location.search}${hash}`;
  if (window.location.hash === hash) return;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

function emitActiveSection(id: BrandManualSectionId) {
  window.dispatchEvent(new CustomEvent(BRAND_MANUAL_ACTIVE_EVENT, { detail: { id } }));
}

export function BrandManualViewer() {
  const locale = useLocale();
  const t = useTranslations("brandManual");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingSectionRef = useRef<BrandManualSectionId | null>(null);
  const [activeSection, setActiveSection] = useState<BrandManualSectionId>("cover");

  const sendNavigation = useCallback((id: BrandManualSectionId) => {
    pendingSectionRef.current = id;
    iframeRef.current?.contentWindow?.postMessage(
      { type: BRAND_MANUAL_NAVIGATE_EVENT, version: MANUAL_MESSAGE_VERSION, id },
      window.location.origin,
    );
  }, []);

  const navigateToSection = useCallback(
    (id: BrandManualSectionId, focusManual = true) => {
      setActiveSection(id);
      setManualHash(id, "push");
      emitActiveSection(id);
      sendNavigation(id);
      if (focusManual) iframeRef.current?.contentWindow?.focus();
    },
    [sendNavigation],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        type?: unknown;
        version?: unknown;
        id?: unknown;
        navigationComplete?: unknown;
      };
      if (data?.version !== MANUAL_MESSAGE_VERSION) return;

      if (data.type === "corecoord-manual:ready") {
        const id = sectionFromHash() ?? pendingSectionRef.current ?? "cover";
        sendNavigation(id);
        return;
      }
      if (data.type !== BRAND_MANUAL_ACTIVE_EVENT || !isBrandManualSectionId(data.id)) return;
      if (pendingSectionRef.current && data.id !== pendingSectionRef.current && data.navigationComplete !== true) return;

      pendingSectionRef.current = null;
      setActiveSection(data.id);
      setManualHash(data.id);
      emitActiveSection(data.id);
    };

    const onNavigate = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isBrandManualSectionId(id)) navigateToSection(id, true);
    };

    const onHistoryChange = () => {
      const id = sectionFromHash();
      if (id) {
        setActiveSection(id);
        sendNavigation(id);
      } else if (window.location.hash === "") {
        setActiveSection("cover");
        sendNavigation("cover");
      }
    };

    window.addEventListener("message", onMessage);
    window.addEventListener(BRAND_MANUAL_NAVIGATE_EVENT, onNavigate);
    window.addEventListener("hashchange", onHistoryChange);
    window.addEventListener("popstate", onHistoryChange);
    onHistoryChange();

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(BRAND_MANUAL_NAVIGATE_EVENT, onNavigate);
      window.removeEventListener("hashchange", onHistoryChange);
      window.removeEventListener("popstate", onHistoryChange);
    };
  }, [navigateToSection, sendNavigation]);

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    if (isBrandManualSectionId(id)) navigateToSection(id, false);
  };

  return (
    <section className="min-w-0 border-y border-neutral-200 bg-neutral-100" aria-label={t("title")}>
      <div className="sticky top-16 z-30 border-b border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md lg:hidden">
        <label htmlFor="brand-manual-section" className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.08em] text-neutral-600">
          <ListTree aria-hidden="true" className="size-4 text-indigo-700" />
          {t("title")}
        </label>
        <select
          id="brand-manual-section"
          value={activeSection}
          onChange={handleSelect}
          aria-label={t("navigation")}
          className="mt-2 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-[13px] font-bold text-indigo-800 outline-none focus:border-coral-500"
        >
          {BRAND_MANUAL_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {locale === "zh" ? section.zh : section.en}
            </option>
          ))}
        </select>
      </div>
      <iframe
        ref={iframeRef}
        name="brand-manual"
        src={BRAND_MANUAL_EMBED_URL}
        title={t("iframeTitle")}
        loading="eager"
        onLoad={() => sendNavigation(sectionFromHash() ?? "cover")}
        tabIndex={0}
        className="block h-[calc(100dvh-220px)] min-h-0 w-full border-0 bg-white outline-none lg:h-[calc(100vh-76px)] lg:min-h-[720px]"
      />
    </section>
  );
}
