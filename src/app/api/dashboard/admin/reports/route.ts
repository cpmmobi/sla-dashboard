import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { getAdminReportRecordsWithFilters } from "@/lib/mock-backend";
import { parseReportFilters } from "@/lib/report-query";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);

  let adminSession;
  try {
    adminSession = await getCurrentAdminSession();
  } catch (error) {
    console.error("Failed to resolve admin session for reports API", error);
    return NextResponse.json(
      { message: getApiMessage(locale, "adminLoginUnavailable") },
      { status: 503 },
    );
  }

  if (!adminSession) {
    return NextResponse.json(
      { message: getApiMessage(locale, "adminUnauthorized") },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseReportFilters(Object.fromEntries(searchParams.entries()));
    const records = await getAdminReportRecordsWithFilters(locale, adminSession, filters);
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Failed to load admin reports", error);
    return NextResponse.json(
      { message: getApiMessage(locale, "adminLoginUnavailable") },
      { status: 503 },
    );
  }
}
