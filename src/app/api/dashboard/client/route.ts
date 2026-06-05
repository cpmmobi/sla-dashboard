import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { getClientDashboard } from "@/lib/mock-backend";
import { normalizeClientReportFilters, parseReportFilters } from "@/lib/report-query";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const { searchParams } = new URL(request.url);
  const authCode = searchParams.get("auth");
  const domain = searchParams.get("domain");
  const filters = normalizeClientReportFilters(parseReportFilters(Object.fromEntries(searchParams.entries())));

  const dashboard = await getClientDashboard(authCode, locale, domain, filters);

  if (!dashboard) {
    return NextResponse.json(
      { message: getApiMessage(locale, "dashboardNotFound") },
      { status: 404 },
    );
  }

  return NextResponse.json(dashboard);
}
