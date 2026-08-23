import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: { default: t("title"), template: t("template") },
    description: t("description"),
    icons: {
      icon: [
        { url: "/assets/brand/corecoord/2026.1/logo-final-2026/icons/favicon.ico" },
        { url: "/assets/brand/corecoord/2026.1/logo-final-2026/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/assets/brand/corecoord/2026.1/logo-final-2026/icons/apple-touch-icon.png",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
