import { AdminAnnouncementManager } from "@/components/admin-announcement-manager";
import { DashboardShell } from "@/components/dashboard-ui";
import { requireAdminSession } from "@/lib/admin-auth";
import { buildAdminNav } from "@/lib/admin-nav";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";
import { getManagedAnnouncements } from "@/lib/mock-backend";

export default async function AdminAnnouncementsPage() {
  const adminSession = await requireAdminSession();
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);
  const announcements = await getManagedAnnouncements(adminSession);
  const nav = buildAdminNav(locale, adminSession, "announcements");

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
