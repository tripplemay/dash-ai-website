"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  BookOpen,
  CircleHelp,
  FolderDown,
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

export function SiteHeader({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");
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
        ? "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-[10px] font-bold transition-colors"
        : "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-bold tracking-wide transition-colors",
      isActive(href)
        ? "bg-cyan/15 text-cyan"
        : mobile
          ? "text-[#8FA3DC] hover:bg-white/10 hover:text-white"
          : "text-[#BFEFFF] hover:bg-cyan/10 hover:text-cyan"
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
        <span className={mobile ? "truncate" : ""}>{t(key)}</span>
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

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-[#DCE6F7] bg-deep px-4 py-5 lg:flex">
        <Link href="/workspace" aria-label={t("workspace")} className="flex items-center gap-3 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/img/logo/DASH-mark-dark_1024.png"
            alt="DASH AI"
            className="logo-rounded size-10 object-cover"
          />
          <span className="text-[18px] font-extrabold tracking-[2px] text-white">
            DASH <em className="not-italic text-cyan">AI</em>
          </span>
        </Link>

        <form onSubmit={submitSearch} role="search" className="relative mt-7">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8FA3DC]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="h-10 w-full rounded-[10px] border border-white/15 bg-white/8 pr-3 pl-9 text-[12px] text-white outline-none placeholder:text-[#8FA3DC] focus:border-cyan"
          />
        </form>

        <nav aria-label={t("primaryNavigation")} className="mt-7 flex flex-col gap-1">
          {renderPrimary()}
        </nav>
        <div className="my-5 border-t border-white/10" />
        <div className="px-3 text-[10px] font-extrabold tracking-[2px] text-[#7186C1]">{t("more")}</div>
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

        <div className="mt-auto border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => switchLocale(locale === "zh" ? "en" : "zh")}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-[#BFEFFF] transition-colors hover:bg-white/10 hover:text-white"
          >
            <Languages aria-hidden="true" className="size-[17px]" />
            {locale === "zh" ? "English" : "中文"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-[#8FA3DC] transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut aria-hidden="true" className="size-[17px]" />
            {t("logout")}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#DCE6F7] bg-deep/95 px-4 backdrop-blur-md lg:hidden">
        <Link href="/workspace" aria-label={t("workspace")} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/logo/DASH-mark-dark_1024.png" alt="DASH AI" className="logo-rounded size-8 object-cover" />
          <span className="text-[16px] font-extrabold tracking-[1.5px] text-white">
            DASH <em className="not-italic text-cyan">AI</em>
          </span>
        </Link>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            type="button"
            aria-label={t("more")}
            className="ml-auto inline-flex size-10 items-center justify-center rounded-[10px] text-white hover:bg-white/10"
          >
            {moreOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(22rem,88vw)] bg-deep text-white">
            <SheetTitle className="text-white">{t("more")}</SheetTitle>
            <form onSubmit={submitSearch} role="search" className="relative mt-5">
              <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8FA3DC]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                className="h-10 w-full rounded-[10px] border border-white/15 bg-white/8 pr-3 pl-9 text-[12px] text-white outline-none placeholder:text-[#8FA3DC] focus:border-cyan"
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
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-[#BFEFFF] hover:bg-white/10"
              >
                <Languages aria-hidden="true" className="size-[17px]" />
                {locale === "zh" ? "English" : "中文"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-[#8FA3DC] hover:bg-white/10 hover:text-white"
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
        className="fixed right-0 bottom-0 left-0 z-40 flex border-t border-[#DCE6F7] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(27,42,107,.08)] backdrop-blur-md lg:hidden"
      >
        {renderPrimary(true)}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[10px] px-2 py-2 text-[10px] font-bold text-[#8FA3DC] hover:bg-[#F0F5FC] hover:text-navy"
          aria-label={t("more")}
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
          <span>{t("more")}</span>
        </button>
      </nav>
    </>
  );
}
