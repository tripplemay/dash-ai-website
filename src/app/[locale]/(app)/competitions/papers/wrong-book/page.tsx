import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { WrongBookList } from "@/components/wrong-book-list";
import { Link } from "@/i18n/navigation";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "practiceWrongBook");
}

export default async function WrongBookPage() {
  const t = await getTranslations("competitions");

  return (
    <>
      <AppPageHero className="pt-6 pb-5 sm:pt-9 sm:pb-7">
        <Link
          href="/competitions/papers"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-wider text-neutral-300 transition-colors hover:text-coral-300"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToPapers")}
        </Link>
        <div className="mt-3 font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("wrongBookEyebrow")}</div>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px]">{t("wrongBookTitle")}</h1>
        <div className="mt-2 max-w-[720px] text-[13.5px] leading-6 tracking-wide text-neutral-300">{t("wrongBookSubtitle")}</div>
      </AppPageHero>

      <section className="w-full px-5 py-6 sm:px-7">
        <WrongBookList />
      </section>
    </>
  );
}
