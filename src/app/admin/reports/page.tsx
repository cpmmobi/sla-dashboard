import { DashboardShell } from "@/components/dashboard-ui";
import { buildAdminNav } from "@/lib/admin-nav";
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
  const nav = buildAdminNav(locale, adminSession, "reports");

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
