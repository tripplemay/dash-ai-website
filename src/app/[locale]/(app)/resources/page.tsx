import { useTranslations } from "next-intl";
import { Spotlight } from "@/components/aceternity/spotlight";
import { ResourceCenter } from "@/components/resource-center";
import { listEnabledResources } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ResourcesPage() {
  const t = useTranslations("resources");
  const items = listEnabledResources();
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#101C52,#1B2A6B)] pt-11 pb-8.5 text-white">
        <Spotlight className="-top-24 left-1/3" fill="#00E5FF" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <h1 className="text-[32px] font-extrabold tracking-[2px]">
            {t("title1")}
            <em className="not-italic text-cyan">{t("title2")}</em>
          </h1>
          <div className="mt-2 text-[13.5px] tracking-wide text-[#9FB3E8]">{t("sub")}</div>
        </div>
      </section>
      <ResourceCenter items={items} />
    </>
  );
}
