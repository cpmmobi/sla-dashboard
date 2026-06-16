import { redirect } from "next/navigation";
import { AdminAccountManager } from "@/components/admin-account-manager";
import { DashboardShell } from "@/components/dashboard-ui";
import { requireAdminSession } from "@/lib/admin-auth";
import { buildAdminNav } from "@/lib/admin-nav";
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
  const nav = buildAdminNav(locale, adminSession, "accounts");

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
