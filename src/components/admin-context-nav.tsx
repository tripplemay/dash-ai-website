"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { FolderDown, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard },
  { href: "/admin/accounts", key: "accounts", icon: Users },
  { href: "/admin/resources", key: "resources", icon: FolderDown },
] as const;

/** Contextual navigation for admin pages inside the shared site shell. */
export function AdminContextNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();

  const isActive = (href: (typeof ADMIN_NAV)[number]["href"]) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-w-0 border-b border-neutral-200 pb-4">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[1.8px] text-coral-700">{t("console")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("contextDescription")}</p>
        </div>
        <nav
          aria-label={t("console")}
          className="flex min-w-0 max-w-full gap-1 overflow-x-auto pb-1 sm:justify-end"
        >
          {ADMIN_NAV.map(({ href, key, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[13px] font-bold transition-colors",
                isActive(href)
                  ? "bg-coral-500/15 text-coral-700"
                  : "text-muted-foreground hover:bg-indigo-50 hover:text-indigo-800",
              )}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="size-4" />
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
