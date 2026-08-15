"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Languages, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", key: "home" },
  { href: "/resources", key: "resources" },
  { href: "/course", key: "course" },
  { href: "/player", key: "player" },
  { href: "/guide", key: "guide" },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  // 大屏播放页 / 课程演示页全屏展示，隐藏顶栏
  if (pathname === "/player" || pathname.startsWith("/course/present")) return null;

  const switchLocale = (l: "zh" | "en") => router.replace(pathname, { locale: l });

  const logout = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const linkCls = (href: string) =>
    cn(
      "rounded-[10px] px-3.5 py-2 text-sm tracking-wide text-[#BFEFFF] transition-colors hover:bg-cyan/15 hover:text-cyan",
      (href === "/" ? pathname === "/" : pathname.startsWith(href)) && "bg-cyan/15 text-cyan"
    );

  return (
    <header className="sticky top-0 z-50 flex items-center gap-3.5 bg-deep/92 px-7 py-3 backdrop-blur-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/img/logo/DASH-mark-dark_1024.png" alt="logo" className="logo-rounded h-[38px] w-[38px] object-cover" />
      <div className="text-[19px] font-extrabold tracking-[2px] text-white">
        DASH <em className="not-italic text-cyan">AI</em>
      </div>

      <nav className="ml-auto hidden items-center gap-1 md:flex">
        {NAV.map((n) => (
          <Link key={n.key} href={n.href} className={linkCls(n.href)}>
            {t(n.key)}
          </Link>
        ))}
        <Link href="/brand" className={linkCls("/brand")}>
          {t("brand")}
        </Link>
        {isAdmin && (
          <Link href="/admin" className={linkCls("/admin")}>
            {t("admin")}
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-2.5 flex items-center gap-1.5 rounded-[10px] border border-cyan/50 px-3 py-1.5 text-xs font-bold tracking-widest text-cyan">
            <Languages className="size-3.5" />
            {locale === "zh" ? "EN" : "中文"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => switchLocale("zh")}>中文</DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchLocale("en")}>English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="ml-2 text-[#8FA3DC] hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
          {t("logout")}
        </Button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="ml-auto text-white md:hidden">
          <Menu className="size-6" />
        </SheetTrigger>
        <SheetContent side="right" className="bg-deep text-white">
          <SheetTitle className="text-white">DASH AI</SheetTitle>
          <div className="mt-6 flex flex-col gap-2">
            {NAV.map((n) => (
              <Link key={n.key} href={n.href} onClick={() => setOpen(false)} className={linkCls(n.href)}>
                {t(n.key)}
              </Link>
            ))}
            <Link href="/brand" onClick={() => setOpen(false)} className={linkCls("/brand")}>
              {t("brand")}
            </Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className={linkCls("/admin")}>
                {t("admin")}
              </Link>
            )}
            <button onClick={() => switchLocale(locale === "zh" ? "en" : "zh")} className={cn(linkCls("/lang"), "text-left")}>
              {locale === "zh" ? "English" : "中文"}
            </button>
            <button onClick={logout} className={cn(linkCls("/logout"), "text-left")}>
              {t("logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
