import { redirect } from "next/navigation";
import { AdminAccountManager } from "@/components/admin-account-manager";
import { DashboardShell } from "@/components/dashboard-ui";
import { requireAdminSession } from "@/lib/admin-auth";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { getManagedAdminAccounts } from "@/lib/mock-backend";

export default async function AdminAccountsPage() {
  const adminSession = await requireAdminSession();

  if (adminSession.role !== "super_admin") {
    redirect("/admin/reports");
  }

  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const accounts = await getManagedAdminAccounts(adminSession, locale);
  const nav = [
    { label: t.adminAccountsPage.nav.trafficBoard, href: "/admin/traffic-board" },
    { label: t.adminAccountsPage.nav.reports, href: "/admin/reports" },
    { label: t.adminAccountsPage.nav.customers, href: "/admin/customers" },
    { label: t.adminAccountsPage.nav.announcements, href: "/admin/announcements" },
    { label: t.adminAccountsPage.nav.accounts, href: "/admin/accounts", active: true },
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
      <AdminAccountManager
        locale={locale}
        accounts={accounts}
        currentUsername={adminSession.username}
      />
    </DashboardShell>
  );
}
