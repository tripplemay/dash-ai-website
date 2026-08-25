import { getTranslations } from "next-intl/server";
import { ArrowRight, Eye, Wand2 } from "lucide-react";
import { CoordinateField } from "@/components/coordinate-field";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "@/i18n/navigation";
import { PARENT_FAQ } from "@/lib/parent-faq";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "parentFaq");
}

export default async function ParentFaqPage() {
  const t = await getTranslations("parentFaq");

  return (
    <>
      <section className="relative overflow-hidden bg-reverse-background pt-11 pb-8.5 text-white">
        <CoordinateField className="absolute top-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
        <div className="relative z-10 w-full px-7">
          <div className="font-mono text-[11px] font-extrabold tracking-[2.5px] text-coral-300">{t("eyebrow")}</div>
          <h1 className="mt-2 text-[32px] font-extrabold tracking-[2px]">{t("title")}</h1>
          <div className="mt-2 max-w-[720px] text-[13.5px] leading-6 tracking-wide text-neutral-300">{t("subtitle")}</div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-7 sm:py-12">
        <h2 className="text-[26px] font-extrabold text-indigo-900">{t("sectionTitle")}</h2>
        <div className="mt-1.5 text-[13.5px] leading-6 text-neutral-600">{t("sectionSubtitle")}</div>
        <Accordion className="mt-7 gap-8">
          {PARENT_FAQ.groups.map((group, groupIndex) => (
            <section key={group.id} aria-labelledby={`faq-group-${group.id}`}>
              <div className="flex items-center gap-3 border-b border-neutral-200 pb-2.5">
                <span className="text-[11px] font-extrabold text-coral-700">
                  {String(groupIndex + 1).padStart(2, "0")}
                </span>
                <h3 id={`faq-group-${group.id}`} className="text-[18px] font-extrabold text-indigo-900">
                  {group.title}
                </h3>
              </div>
              <div className="mt-3 space-y-2.5">
                {group.items.map((item) => (
                  <AccordionItem
                    key={item.slug}
                    value={item.slug}
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-card px-0"
                  >
                    <AccordionTrigger className="min-w-0 gap-3 px-4 py-3.5 text-[15px] font-extrabold leading-6 text-indigo-800 hover:no-underline sm:px-4.5">
                      <span className="flex min-w-0 items-start gap-2.5 pr-2">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-indigo-700 text-xs text-white"
                        >
                          Q
                        </span>
                        <span className="min-w-0 break-words">{item.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-5 text-[13.5px] leading-[1.85] text-neutral-600 sm:px-4.5 sm:pl-[52px]">
                      <p className="font-extrabold text-neutral-900">{item.lead}</p>
                      {item.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      <aside className="mt-5 border-l-2 border-coral-500 bg-coral-50 px-3.5 py-3 text-neutral-700">
                        <div className="flex items-start gap-2.5">
                          <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-coral-700" />
                          <div>
                            <div className="text-[12px] font-extrabold text-coral-700">{t("tipLabel")}</div>
                            <p className="mt-1 mb-0">{item.parentTip}</p>
                          </div>
                        </div>
                      </aside>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            </section>
          ))}
        </Accordion>
      </section>

      <section className="border-y border-indigo-200 bg-indigo-50">
        <div className="flex w-full flex-col gap-6 px-7 py-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[720px]">
            <h2 className="text-[22px] font-extrabold leading-8 text-indigo-950">{t("ctaTitle")}</h2>
            <p className="mt-2 text-[13.5px] leading-6 text-neutral-600">{t("ctaDescription")}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <Link
              href="/courses/s0"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-coral-500 px-4.5 py-2.5 text-[13px] font-extrabold text-neutral-950 transition-colors hover:bg-coral-300"
            >
              {t("primaryAction")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href="/courses/wizard"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-indigo-300 bg-white px-4.5 py-2.5 text-[13px] font-extrabold text-indigo-900 transition-colors hover:border-indigo-500 hover:bg-indigo-100"
            >
              <Wand2 aria-hidden="true" className="size-4" />
              {t("secondaryAction")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
