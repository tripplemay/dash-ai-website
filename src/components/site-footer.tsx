"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");
  const pathname = usePathname();

  // 大屏播放页全屏展示，隐藏页脚
  if (pathname === "/player") return null;

  return (
    <footer className="mt-10 bg-deep py-6.5 text-[12.5px] tracking-wide text-[#8FA3DC]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-7">
        <span>{t("left")}</span>
        <b className="text-[#BFEFFF]">{t("right")}</b>
      </div>
    </footer>
  );
}
