import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function getPageMetadata(
  params: Promise<{ locale: string }>,
  key: string
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.pages" });
  return { title: t(key) };
}
