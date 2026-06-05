import { DashboardShell } from "@/components/dashboard-ui";
import { TrafficReportView } from "@/components/traffic-report-view";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { getClientDashboard, recordCustomerReportAccess } from "@/lib/mock-backend";
import { normalizeClientReportFilters, parseReportFilters } from "@/lib/report-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const customerMatchPreviewBaseUrl =
  "https://env-00jxh1c541d5.dev-hz.cloudbasefunction.cn/lives/page";

export default async function CustomerReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ auth: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ auth }, search] = await Promise.all([params, searchParams]);
  const [locale, adminSession, requestHeaders] = await Promise.all([
    getCurrentLocale(),
    getCurrentAdminSession(),
    headers(),
  ]);
  const t = getTranslations(locale);
  const filters = normalizeClientReportFilters(parseReportFilters(search));
  const requestedDomain = typeof search.domain === "string" ? search.domain : undefined;
  const dashboard = await getClientDashboard(auth, locale, requestedDomain, filters);

  if (!dashboard) {
    redirect("/");
  }

  if (!adminSession) {
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    const realIp = requestHeaders.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
    await recordCustomerReportAccess({
      customerId: dashboard.customer.id,
      ipAddress,
      userAgent: requestHeaders.get("user-agent"),
    });
  }

  const canonicalAuth = dashboard.customer.authCode;
  const matchPreviewHref = `${customerMatchPreviewBaseUrl}?auth=${encodeURIComponent(canonicalAuth)}`;
  const nav = [
    { label: t.adminReportsPage.nav.reports, href: `/c/${encodeURIComponent(canonicalAuth)}`, active: true },
    {
      label: t.adminReportsPage.nav.matchPreview,
      href: matchPreviewHref,
      external: true,
    },
  ];

  return (
    <DashboardShell
      locale={locale}
      badge={dashboard.customer.name}
      nav={nav}
      activeLabel={t.common.active}
    >
      <TrafficReportView
        key={`${canonicalAuth}-${JSON.stringify(filters)}`}
        mode="client"
        dashboard={dashboard}
        locale={locale}
        filters={filters}
      />
    </DashboardShell>
  );
}
