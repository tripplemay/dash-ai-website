import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { AppPageHero } from "@/components/app-page-hero";
import { PracticeRunner } from "@/components/practice-runner";
import { Link } from "@/i18n/navigation";
import { findPaperMaterial } from "@/lib/papers";
import { getQuestionSet } from "@/lib/paper-questions";

export default async function PaperPracticePage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  const found = findPaperMaterial(paperId);
  if (!found) notFound();

  const t = await getTranslations("competitions");
  const set = getQuestionSet(paperId);

  return (
    <>
      <AppPageHero className="pt-6 pb-5 sm:pt-9">
        <Link
          href={`/competitions/${found.slug}#papers`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-wider text-neutral-300 transition-colors hover:text-coral-300"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToList")}
        </Link>
        <div className="mt-3 font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("papersEyebrow")}</div>
        <h1 className="mt-2 max-w-3xl text-[24px] leading-snug font-extrabold sm:text-[30px]">{found.material.title}</h1>
        <div className="mt-2 text-[13px] text-neutral-300">
          {found.nameZh} · {found.material.year} · {found.material.stage}
          {set ? ` · ${t("practiceQuestionCount", { count: set.questions.length })}` : ""}
        </div>
      </AppPageHero>

      <section className="w-full px-5 py-6 sm:px-7">
        {set ? (
          <PracticeRunner paperId={paperId} />
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-card p-10 text-center">
            <p className="text-sm leading-7 text-neutral-600">{t("practiceEmpty")}</p>
          </div>
        )}
      </section>
    </>
  );
}
