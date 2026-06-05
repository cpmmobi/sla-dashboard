import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminSession, CustomerRecord } from "@/lib/mock-backend";
import { getAdminByUsername, getCustomerByAuth } from "@/lib/mock-backend";

export type ReportSession =
  | {
      role: "admin";
      admin: AdminSession;
    }
  | {
      role: "customer";
      customer: CustomerRecord;
    };

export async function getCurrentAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const adminUsername = cookieStore.get("sla_admin_user")?.value ?? null;
  return getAdminByUsername(adminUsername);
}

export async function requireAdminSession() {
  const adminSession = await getCurrentAdminSession();

  if (!adminSession) {
    redirect("/");
  }

  return adminSession;
}

export async function requireReportSession(): Promise<ReportSession> {
  const cookieStore = await cookies();
  const adminUsername = cookieStore.get("sla_admin_user")?.value ?? null;
  const adminSession = await getAdminByUsername(adminUsername);

  if (adminSession) {
    return {
      role: "admin",
      admin: adminSession,
    };
  }

  const customerAuthCode = cookieStore.get("sla_customer_auth")?.value ?? null;
  const customer = await getCustomerByAuth(customerAuthCode);

  if (customer && customer.status === "正常") {
    return {
      role: "customer",
      customer,
    };
  }

  redirect("/");
}
