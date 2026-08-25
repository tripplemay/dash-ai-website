"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const brandAccessibleName = locale === "zh" ? "芯坐标 CORECOORD" : "CORECOORD";
  const pathname = usePathname();

  // 全屏播放页 / 课程演示页隐藏页脚，避免覆盖舞台控制栏
  if (
    pathname === "/player" ||
    pathname.startsWith("/course/present") ||
    pathname === "/presentations/screen" ||
    pathname.startsWith("/presentations/course")
  ) return null;

  return (
    <footer className="mt-10 border-t border-white/15 bg-reverse-background py-6 text-[12.5px] tracking-wide text-neutral-400">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-7">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo variant="mark-reverse" width={24} height={24} decorative className="size-6" />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="sr-only">{brandAccessibleName}</span>
            <span>{t("left")}</span>
          </div>
        </div>
        <b className="font-semibold text-neutral-200">{t("right")}</b>
      </div>
    </footer>
  );
}
