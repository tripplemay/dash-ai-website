"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  BookOpen,
  CircleHelp,
  FolderDown,
  ArrowLeft,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  MoreHorizontal,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import {
  BRAND_MANUAL_ACTIVE_EVENT,
  BRAND_MANUAL_EMBED_URL,
  BRAND_MANUAL_NAVIGATE_EVENT,
  BRAND_MANUAL_SECTIONS,
  isBrandManualSectionId,
  type BrandManualSectionId,
} from "@/lib/brand-manual";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/workspace", key: "workspace", icon: LayoutDashboard },
  { href: "/resources", key: "resources", icon: FolderDown },
  { href: "/courses", key: "courses", icon: BookOpen },
  { href: "/presentations", key: "presentations", icon: MonitorPlay },
] as const;

const SECONDARY_NAV = [
  { href: "/help/guide", key: "guide", icon: CircleHelp },
  { href: "/help/brand", key: "brand", icon: Settings2 },
] as const;

const FULLSCREEN_PATHS = ["/player", "/course/present", "/presentations/screen", "/presentations/course"];

function isFullscreenPath(pathname: string) {
  return FULLSCREEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isBrandManualPath(pathname: string) {
  return pathname === "/brand" || pathname.startsWith("/brand/") || pathname === "/help/brand" || pathname.startsWith("/help/brand/");
}

export function SiteHeader({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const brandAccessibleName = locale === "zh" ? "芯坐标 CORECOORD" : "CORECOORD";
  const pathname = usePathname();
  const router = useRouter();
  const brandManualT = useTranslations("brandManual");
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isBrandPage = isBrandManualPath(pathname);
  const [activeBrandSection, setActiveBrandSection] = useState<BrandManualSectionId>("cover");
  const brandNavigationScrollRef = useRef<HTMLDivElement>(null);
  const brandNavigationRef = useRef<HTMLDivElement>(null);
  const brandNavigationReadyRef = useRef(false);

  useEffect(() => {
    if (!isBrandPage) return;
    const onActiveSection = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isBrandManualSectionId(id)) setActiveBrandSection(id);
    };
    const onHashChange = () => {
      let value = window.location.hash.replace(/^#/, "");
      try {
        value = decodeURIComponent(value);
      } catch {
        return;
      }
      const id = value;
      if (isBrandManualSectionId(id)) setActiveBrandSection(id);
      else if (window.location.hash === "") setActiveBrandSection("cover");
    };
    window.addEventListener(BRAND_MANUAL_ACTIVE_EVENT, onActiveSection);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    onHashChange();
    return () => {
      window.removeEventListener(BRAND_MANUAL_ACTIVE_EVENT, onActiveSection);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
  }, [isBrandPage]);

  useEffect(() => {
    if (!isBrandPage) {
      brandNavigationReadyRef.current = false;
      return;
    }
    if (!brandNavigationReadyRef.current) {
      brandNavigationReadyRef.current = true;
      return;
    }
    const scrollContainer = brandNavigationScrollRef.current;
    const link = brandNavigationRef.current?.querySelector<HTMLElement>(
      `[data-brand-section="${activeBrandSection}"]`,
    );
    if (!scrollContainer || !link) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < containerRect.top) {
      scrollContainer.scrollTop -= containerRect.top - linkRect.top;
    } else if (linkRect.bottom > containerRect.bottom) {
      scrollContainer.scrollTop += linkRect.bottom - containerRect.bottom;
    }
  }, [activeBrandSection, isBrandPage]);

  if (isFullscreenPath(pathname)) return null;

  const isActive = (href: string) => {
    if (href === "/workspace") return pathname === "/" || pathname === "/workspace";
    if (href === "/resources") return pathname === "/resources" || pathname.startsWith("/resources/");
    if (href === "/courses") {
      return pathname === "/course" || pathname.startsWith("/course/") || pathname === "/courses" || pathname.startsWith("/courses/");
    }
    if (href === "/presentations") {
      return pathname === "/player" || pathname === "/course/present" || pathname === "/presentations" || pathname.startsWith("/presentations/");
    }
    if (href === "/help/brand") return isBrandPage;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const switchLocale = (nextLocale: "zh" | "en") => {
    const suffix = typeof window === "undefined" ? "" : `${window.location.search}${window.location.hash}`;
    router.replace(`${pathname}${suffix}`, { locale: nextLocale });
    setMoreOpen(false);
  };

  const logout = async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: "{}",
    }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/resources?q=${encodeURIComponent(value)}` : "/resources");
    setMoreOpen(false);
  };

  const navClass = (href: string, mobile = false) =>
    cn(
      mobile
        ? "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] font-bold transition-colors"
        : "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-bold tracking-wide transition-colors",
      isActive(href)
        ? cn("bg-coral-500/15", mobile ? "text-coral-700" : "text-coral-300")
        : mobile
          ? "text-neutral-500 hover:bg-neutral-50 hover:text-indigo-700"
          : "text-neutral-300 hover:bg-white/10 hover:text-white"
    );

  const renderPrimary = (mobile = false) =>
    PRIMARY_NAV.map(({ href, key, icon: Icon }) => (
      <Link
        key={key}
        href={href}
        className={navClass(href, mobile)}
        aria-current={isActive(href) ? "page" : undefined}
        onClick={() => setMoreOpen(false)}
      >
        <Icon aria-hidden="true" className={mobile ? "size-5" : "size-[17px]"} />
        <span className={mobile ? "truncate" : ""}>
          {mobile && key === "presentations" ? t("presentationsShort") : t(key)}
        </span>
      </Link>
    ));

  const renderSecondary = () =>
    SECONDARY_NAV.map(({ href, key, icon: Icon }) => (
      <Link
        key={key}
        href={href}
        className={navClass(href)}
        aria-current={isActive(href) ? "page" : undefined}
        onClick={() => setMoreOpen(false)}
      >
        <Icon aria-hidden="true" className="size-[17px]" />
        {t(key)}
      </Link>
    ));

  const navigateManualSection = (event: MouseEvent<HTMLAnchorElement>, id: BrandManualSectionId) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const hash = id === "cover" ? "" : `#${id}`;
    const next = `${window.location.pathname}${window.location.search}${hash}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", next);
    setActiveBrandSection(id);
    window.dispatchEvent(new CustomEvent(BRAND_MANUAL_NAVIGATE_EVENT, { detail: { id } }));
  };

  const renderBrandManualNavigation = () => (
    <div ref={brandNavigationRef} className="mt-1">
      <Link
        href="/help/guide"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-bold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        onClick={() => setMoreOpen(false)}
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        {t("guide")}
      </Link>
      <div className="mt-3 border-t border-white/10 pt-4">
        <div className="px-3 text-[10px] font-extrabold tracking-[1.6px] text-coral-300">{brandManualT("title")}</div>
        <nav aria-label={brandManualT("navigation")} className="mt-2 flex flex-col gap-0.5">
          {BRAND_MANUAL_SECTIONS.map((section) => {
            const active = activeBrandSection === section.id;
            return (
              <a
                key={section.id}
                href={`${BRAND_MANUAL_EMBED_URL}#${section.id}`}
                target="brand-manual"
                data-brand-section={section.id}
                aria-current={active ? "location" : undefined}
                onClick={(event) => navigateManualSection(event, section.id)}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-[12px] font-semibold leading-5 transition-colors",
                  active ? "bg-coral-500/15 text-coral-200" : "text-neutral-400 hover:bg-white/10 hover:text-white",
                )}
              >
                {locale === "zh" ? section.zh : section.en}
              </a>
            );
          })}
        </nav>
      </div>
      {isAdmin && (
        <Link
          href="/admin"
          className={cn(navClass("/admin"), "mt-3")}
          aria-current={isActive("/admin") ? "page" : undefined}
          onClick={() => setMoreOpen(false)}
        >
          <Settings2 aria-hidden="true" className="size-[17px]" />
          {t("admin")}
        </Link>
      )}
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/15 bg-reverse-background px-4 py-5 lg:flex">
        <Link href="/workspace" aria-label={t("workspace")} className="flex items-center gap-3 px-2">
          <BrandLogo variant="mark-reverse" width={40} height={40} decorative priority className="size-10" />
          <span className="sr-only">{brandAccessibleName}</span>
        </Link>

        <form onSubmit={submitSearch} role="search" className="relative mt-7 shrink-0">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="h-10 w-full rounded-md border border-white/15 bg-white/8 pr-3 pl-9 text-[12px] text-white outline-none placeholder:text-neutral-400 focus:border-coral-300"
          />
        </form>

        <nav aria-label={t("primaryNavigation")} className="mt-7 flex shrink-0 flex-col gap-1">
          {renderPrimary()}
        </nav>
        <div className="my-5 shrink-0 border-t border-white/10" />

        <div ref={brandNavigationScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isBrandPage ? (
            renderBrandManualNavigation()
          ) : (
            <>
              <div className="px-3 text-[10px] font-extrabold tracking-[2px] text-neutral-500">{t("more")}</div>
              <nav aria-label={t("secondaryNavigation")} className="mt-2 flex flex-col gap-1">
                {renderSecondary()}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={navClass("/admin")}
                    aria-current={isActive("/admin") ? "page" : undefined}
                  >
                    <Settings2 aria-hidden="true" className="size-[17px]" />
                    {t("admin")}
                  </Link>
                )}
              </nav>
            </>
          )}
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => switchLocale(locale === "zh" ? "en" : "zh")}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-bold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Languages aria-hidden="true" className="size-[17px]" />
            {locale === "zh" ? "English" : "中文"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-bold text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut aria-hidden="true" className="size-[17px]" />
            {t("logout")}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/15 bg-reverse-background/95 px-4 backdrop-blur-md lg:hidden">
        <Link href="/workspace" aria-label={t("workspace")} className="flex items-center gap-2.5">
          <BrandLogo variant="mark-reverse" width={32} height={32} decorative priority className="size-8" />
          <span className="sr-only">{brandAccessibleName}</span>
        </Link>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            type="button"
            aria-label={t("more")}
            className="ml-auto inline-flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10"
          >
            {moreOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(22rem,88vw)] border-white/15 bg-reverse-background text-white">
            <SheetTitle className="text-white">{t("more")}</SheetTitle>
            <form onSubmit={submitSearch} role="search" className="relative mt-5">
              <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                className="h-10 w-full rounded-md border border-white/15 bg-white/8 pr-3 pl-9 text-[12px] text-white outline-none placeholder:text-neutral-400 focus:border-coral-300"
              />
            </form>
            <nav aria-label={t("secondaryNavigation")} className="mt-6 flex flex-col gap-1">
              {renderSecondary()}
              {isAdmin && (
                <Link href="/admin" onClick={() => setMoreOpen(false)} className={navClass("/admin")}>
                  <Settings2 aria-hidden="true" className="size-[17px]" />
                  {t("admin")}
                </Link>
              )}
            </nav>
            <div className="mt-5 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => switchLocale(locale === "zh" ? "en" : "zh")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-bold text-neutral-300 hover:bg-white/10"
              >
                <Languages aria-hidden="true" className="size-[17px]" />
                {locale === "zh" ? "English" : "中文"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-bold text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                <LogOut aria-hidden="true" className="size-[17px]" />
                {t("logout")}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <nav
        aria-label={t("primaryNavigation")}
        className="fixed right-0 bottom-0 left-0 z-40 flex border-t border-neutral-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(34,54,123,.12)] backdrop-blur-md lg:hidden"
      >
        {renderPrimary(true)}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] font-bold text-neutral-500 hover:bg-neutral-50 hover:text-indigo-700"
          aria-label={t("more")}
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
          <span>{t("more")}</span>
        </button>
      </nav>
    </>
  );
}
