import { redirect } from "next/navigation";
import { getRequestHeaders, getRequestSession } from "@/lib/request-session";
import { AUTH_DISABLED } from "@/lib/auth";
import { getSafeReturnTo, RETURN_TO_HEADER } from "@/lib/return-to";
import { AdminContextNav } from "@/components/admin-context-nav";
import { getPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return getPageMetadata(params, "admin");
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!AUTH_DISABLED) {
    const requestHeaders = await getRequestHeaders();
    const session = await getRequestSession();
    if (!session) {
      const returnTo = getSafeReturnTo(requestHeaders.get(RETURN_TO_HEADER), locale) ?? `/${locale}/admin`;
      redirect(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    if ((session.user as { role?: string }).role !== "admin") {
      redirect(`/${locale}/workspace`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-6 sm:px-7 lg:py-8">
      <AdminContextNav />
      <div className="mt-7 min-w-0">{children}</div>
    </div>
  );
}
