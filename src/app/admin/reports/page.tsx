import { DashboardShell } from "@/components/dashboard-ui";
import { TrafficReportView } from "@/components/traffic-report-view";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminReportRecordsWithFilters } from "@/lib/mock-backend";
import { parseReportFilters } from "@/lib/report-query";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminSession();
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const filters = parseReportFilters(params);
  const reportRecords = await getAdminReportRecordsWithFilters(locale, adminSession, filters);
  const nav = [
    { label: t.adminReportsPage.nav.trafficBoard, href: "/admin/traffic-board" },
    { label: t.adminReportsPage.nav.reports, href: "/admin/reports", active: true },
    { label: t.adminReportsPage.nav.customers, href: "/admin/customers" },
    { label: t.adminReportsPage.nav.announcements, href: "/admin/announcements" },
    ...(adminSession.role === "super_admin"
      ? [{ label: t.adminReportsPage.nav.accounts, href: "/admin/accounts" }]
      : []),
  ];

  return (
    <DashboardShell
      locale={locale}
      badge={t.common.adminBadge}
      nav={nav}
      activeLabel={t.common.active}
      logoutLabel={t.common.signOut}
      logoutHref="/api/logout"
    >
      <TrafficReportView
        key={JSON.stringify(filters)}
        mode="admin"
        records={reportRecords}
        locale={locale}
        filters={filters}
      />
    </DashboardShell>
  );
}
