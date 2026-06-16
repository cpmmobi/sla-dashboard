import { AdminCustomersContent } from "@/components/admin-customers-content";
import { DashboardShell } from "@/components/dashboard-ui";
import { buildAdminNav } from "@/lib/admin-nav";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminView } from "@/lib/mock-backend";

export default async function AdminCustomersPage() {
  const adminSession = await requireAdminSession();
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const adminView = await getAdminView(locale, adminSession);
  const nav = buildAdminNav(locale, adminSession, "customers");

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
