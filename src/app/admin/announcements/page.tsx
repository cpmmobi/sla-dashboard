import { AdminAnnouncementManager } from "@/components/admin-announcement-manager";
import { DashboardShell } from "@/components/dashboard-ui";
import { requireAdminSession } from "@/lib/admin-auth";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { getManagedAnnouncements } from "@/lib/mock-backend";

export default async function AdminAnnouncementsPage() {
  const adminSession = await requireAdminSession();
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const announcements = await getManagedAnnouncements(adminSession);
  const nav = [
    { label: t.adminAnnouncementsPage.nav.trafficBoard, href: "/admin/traffic-board" },
    { label: t.adminAnnouncementsPage.nav.reports, href: "/admin/reports" },
    { label: t.adminAnnouncementsPage.nav.customers, href: "/admin/customers" },
    { label: t.adminAnnouncementsPage.nav.announcements, href: "/admin/announcements", active: true },
    ...(adminSession.role === "super_admin"
      ? [{ label: t.adminAnnouncementsPage.nav.accounts, href: "/admin/accounts" }]
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
      <AdminAnnouncementManager locale={locale} announcements={announcements} />
    </DashboardShell>
  );
}
