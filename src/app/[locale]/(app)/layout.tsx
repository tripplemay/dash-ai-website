import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, AUTH_DISABLED } from "@/lib/auth";
import { getSafeReturnTo, RETURN_TO_HEADER } from "@/lib/return-to";
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
  let isAdmin = false;
  if (!AUTH_DISABLED) {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) {
      const loginUrl = new URL(`/${locale}/login`, "http://dash-ai.invalid");
      const returnTo = getSafeReturnTo(requestHeaders.get(RETURN_TO_HEADER), locale);
      if (returnTo) loginUrl.searchParams.set("returnTo", returnTo);
      redirect(`${loginUrl.pathname}${loginUrl.search}`);
    }
    isAdmin = (session.user as { role?: string }).role === "admin";
  }
  return (
    <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
      <SiteHeader isAdmin={isAdmin} />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      <SiteFooter />
    </div>
  );
}
