"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { ArrowLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";

const ADMIN_NAV = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/accounts", key: "accounts" },
  { href: "/admin/resources", key: "resources" },
] as const;

export function AdminNav() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const brandAccessibleName = locale === "zh" ? "芯坐标 CORECOORD" : "CORECOORD";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: (typeof ADMIN_NAV)[number]["href"]) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  const linkClassName = (href: (typeof ADMIN_NAV)[number]["href"]) =>
    cn(
      "rounded-md px-3.5 py-2 text-sm tracking-wide text-neutral-300 transition-colors hover:bg-coral-500/15 hover:text-coral-300",
      isActive(href) && "bg-coral-500/15 text-coral-300"
    );

  return (
    <header className="sticky top-0 z-50 flex items-center gap-3.5 border-b border-white/15 bg-reverse-background/95 px-4 py-3 backdrop-blur-md md:px-7">
      <Link href="/admin" aria-label={t("console")} className="flex min-w-0 items-center gap-3.5">
        <BrandLogo variant="mark-reverse" width={34} height={34} decorative priority className="size-[34px]" />
        <span className="truncate text-[17px] font-extrabold tracking-[1px] text-white">
          <span className="sr-only">{brandAccessibleName}</span>
          <span className="ml-2 rounded-sm bg-coral-500/15 px-2 py-0.5 text-[11px] tracking-widest text-coral-300">
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
          className="hidden items-center gap-1.5 rounded-md border border-coral-300/60 px-3 py-1.5 text-xs font-bold tracking-widest text-coral-300 md:flex"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToSite")}
        </Link>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          type="button"
          aria-label={t("console")}
          className="ml-auto inline-flex size-10 items-center justify-center rounded-md text-white transition-colors hover:bg-coral-500/15 hover:text-coral-300 md:hidden"
        >
          <Menu aria-hidden="true" className="size-6" />
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(20rem,85vw)] border-white/15 bg-reverse-background text-white">
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
              className="mt-3 flex items-center gap-1.5 rounded-md border border-coral-300/60 px-3.5 py-2 text-sm font-bold tracking-wide text-coral-300 transition-colors hover:bg-coral-500/15"
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
