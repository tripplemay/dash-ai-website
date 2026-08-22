"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");
  const pathname = usePathname();

  // 全屏播放页 / 课程演示页隐藏页脚，避免覆盖舞台控制栏
  if (
    pathname === "/player" ||
    pathname.startsWith("/course/present") ||
    pathname === "/presentations/screen" ||
    pathname.startsWith("/presentations/course")
  ) return null;

  return (
    <footer className="mt-10 bg-deep py-6.5 text-[12.5px] tracking-wide text-[#8FA3DC]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-7">
        <span>{t("left")}</span>
        <b className="text-[#BFEFFF]">{t("right")}</b>
      </div>
    </footer>
  );
}
