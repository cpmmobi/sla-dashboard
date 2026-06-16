import { getTranslations, type Locale } from "@/lib/i18n";
import type { AdminSession } from "@/lib/mock-backend";

type AdminNavKey =
  | "trafficBoard"
  | "reports"
  | "customers"
  | "announcements"
  | "accounts";

const adminNavRoutes: Record<AdminNavKey, string> = {
  trafficBoard: "/admin/traffic-board",
  reports: "/admin/reports",
  customers: "/admin/customers",
  announcements: "/admin/announcements",
  accounts: "/admin/accounts",
};

export function buildAdminNav(
  locale: Locale,
  adminSession: AdminSession,
  activeKey: AdminNavKey,
) {
  const t = getTranslations(locale);
  const labels = t.adminNav;

  return (Object.keys(adminNavRoutes) as AdminNavKey[])
    .filter((key) => key !== "accounts" || adminSession.role === "super_admin")
    .map((key) => ({
      label: labels[key],
      href: adminNavRoutes[key],
      active: key === activeKey,
    }));
}
