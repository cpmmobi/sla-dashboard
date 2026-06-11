import { AdminCustomersContent } from "@/components/admin-customers-content";
import { DashboardShell } from "@/components/dashboard-ui";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminView } from "@/lib/mock-backend";

export default async function AdminCustomersPage() {
  const adminSession = await requireAdminSession();
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const adminView = await getAdminView(locale, adminSession);
  const nav = [
    { label: t.adminCustomersPage.nav.trafficBoard, href: "/admin/traffic-board" },
    { label: t.adminCustomersPage.nav.reports, href: "/admin/reports" },
    { label: t.adminCustomersPage.nav.customers, href: "/admin/customers", active: true },
    { label: t.adminCustomersPage.nav.announcements, href: "/admin/announcements" },
    ...(adminSession.role === "super_admin"
      ? [{ label: t.adminCustomersPage.nav.accounts, href: "/admin/accounts" }]
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
      <AdminCustomersContent
        locale={locale}
        customers={adminView.customers}
        currentAdmin={adminSession}
      />
    </DashboardShell>
  );
}
