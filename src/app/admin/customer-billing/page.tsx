import { AdminTrafficBoard } from "@/components/admin-traffic-board";
import { DashboardShell } from "@/components/dashboard-ui";
import { requireAdminSession } from "@/lib/admin-auth";
import { buildAdminNav } from "@/lib/admin-nav";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { getTrafficBoardShellView, type TrafficBoardPeriod } from "@/lib/mock-backend";

const customerBillingPeriods: TrafficBoardPeriod[] = ["cycleWaiver", "newCustomerGift"] as const;

function parseCustomerBillingPeriod(value: string | string[] | undefined): TrafficBoardPeriod {
  return value === "cycleWaiver" || value === "newCustomerGift" ? value : "cycleWaiver";
}

export default async function AdminCustomerBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminSession();
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const period = parseCustomerBillingPeriod(params.period);
  const view = await getTrafficBoardShellView(locale, adminSession, period);
  const nav = buildAdminNav(locale, adminSession, "customerBilling");

  return (
    <DashboardShell
      locale={locale}
      badge={t.common.adminBadge}
      nav={nav}
      activeLabel={t.common.active}
      logoutLabel={t.common.signOut}
      logoutHref="/api/logout"
    >
      <AdminTrafficBoard
        locale={locale}
        view={view}
        canViewTrafficMarkup={adminSession.role === "super_admin"}
        availablePeriods={customerBillingPeriods}
        tableTitle={t.adminCustomerBillingPage.tableTitle}
      />
    </DashboardShell>
  );
}
