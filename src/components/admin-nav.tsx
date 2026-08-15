"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/accounts", key: "accounts" },
  { href: "/admin/resources", key: "resources" },
] as const;

export function AdminNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center gap-3.5 bg-deep/95 px-7 py-3 backdrop-blur-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/img/logo/DASH-mark-dark_1024.png" alt="logo" className="logo-rounded h-[34px] w-[34px] object-cover" />
      <div className="text-[17px] font-extrabold tracking-[2px] text-white">
        DASH <em className="not-italic text-cyan">AI</em>
        <span className="ml-2 rounded-md bg-cyan/15 px-2 py-0.5 text-[11px] tracking-widest text-cyan">
          {t("console")}
        </span>
      </div>
      <nav className="ml-6 flex items-center gap-1">
        {ADMIN_NAV.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            className={cn(
              "rounded-[10px] px-3.5 py-2 text-sm tracking-wide text-[#BFEFFF] transition-colors hover:bg-cyan/15 hover:text-cyan",
              (n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)) &&
                "bg-cyan/15 text-cyan"
            )}
          >
            {t(`nav.${n.key}`)}
          </Link>
        ))}
      </nav>
      <div className="ml-auto">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-[10px] border border-cyan/40 px-3 py-1.5 text-xs font-bold tracking-widest text-cyan"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToSite")}
        </Link>
      </div>
    </header>
  );
}
