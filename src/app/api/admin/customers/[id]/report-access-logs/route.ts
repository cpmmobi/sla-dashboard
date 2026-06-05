import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { normalizeLocale } from "@/lib/i18n";
import { getCustomerReportAccessLogs } from "@/lib/mock-backend";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await getCurrentAdminSession();

  if (!adminSession) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);

  try {
    const logs = await getCustomerReportAccessLogs(id, adminSession, locale);
    return NextResponse.json({ logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ message: locale === "en" ? "Customer not found." : "未找到该客户。" }, { status: 404 });
    }

    return NextResponse.json(
      { message: locale === "en" ? "Service unavailable." : "服务暂时不可用。" },
      { status: 500 },
    );
  }
}
