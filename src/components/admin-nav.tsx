"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { ArrowLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ADMIN_NAV = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/accounts", key: "accounts" },
  { href: "/admin/resources", key: "resources" },
] as const;

export function AdminNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: (typeof ADMIN_NAV)[number]["href"]) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  const linkClassName = (href: (typeof ADMIN_NAV)[number]["href"]) =>
    cn(
      "rounded-[10px] px-3.5 py-2 text-sm tracking-wide text-[#BFEFFF] transition-colors hover:bg-cyan/15 hover:text-cyan",
      isActive(href) && "bg-cyan/15 text-cyan"
    );

  return (
    <header className="sticky top-0 z-50 flex items-center gap-3.5 bg-deep/95 px-4 py-3 backdrop-blur-md md:px-7">
      <Link href="/admin" aria-label={t("console")} className="flex min-w-0 items-center gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/img/logo/DASH-mark-dark_1024.png"
          alt="DASH AI"
          className="logo-rounded h-[34px] w-[34px] shrink-0 object-cover"
        />
        <span className="truncate text-[17px] font-extrabold tracking-[2px] text-white">
          DASH <em className="not-italic text-cyan">AI</em>
          <span className="ml-2 rounded-md bg-cyan/15 px-2 py-0.5 text-[11px] tracking-widest text-cyan">
            {t("console")}
          </span>
        </span>
      </Link>

      <nav aria-label={t("console")} className="ml-6 hidden items-center gap-1 md:flex">
        {ADMIN_NAV.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            className={linkClassName(n.href)}
            aria-current={isActive(n.href) ? "page" : undefined}
          >
            {t(`nav.${n.key}`)}
          </Link>
        ))}
      </nav>

      <div className="ml-auto">
        <Link
          href="/workspace"
          className="hidden items-center gap-1.5 rounded-[10px] border border-cyan/40 px-3 py-1.5 text-xs font-bold tracking-widest text-cyan md:flex"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToSite")}
        </Link>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          type="button"
          aria-label={t("console")}
          className="ml-auto inline-flex size-10 items-center justify-center rounded-[10px] text-white transition-colors hover:bg-cyan/15 hover:text-cyan md:hidden"
        >
          <Menu aria-hidden="true" className="size-6" />
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(20rem,85vw)] bg-deep text-white">
          <SheetTitle className="text-white">{t("console")}</SheetTitle>
          <nav aria-label={t("console")} className="mt-6 flex flex-col gap-2">
            {ADMIN_NAV.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                onClick={() => setOpen(false)}
                className={linkClassName(n.href)}
                aria-current={isActive(n.href) ? "page" : undefined}
              >
                {t(`nav.${n.key}`)}
              </Link>
            ))}
            <Link
              href="/workspace"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center gap-1.5 rounded-[10px] border border-cyan/40 px-3.5 py-2 text-sm font-bold tracking-wide text-cyan transition-colors hover:bg-cyan/15"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              {t("backToSite")}
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
