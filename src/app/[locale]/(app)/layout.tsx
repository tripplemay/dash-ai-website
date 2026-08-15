import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!AUTH_DISABLED) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect(`/${locale}/login`);
  }
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
