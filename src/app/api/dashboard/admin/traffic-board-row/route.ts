import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { getTrafficBoardRow, type TrafficBoardPeriod } from "@/lib/mock-backend";

function stringifyTrafficBoardRouteLog(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function parseTrafficBoardPeriod(value: string | null): TrafficBoardPeriod {
  return value === "today" ||
    value === "last24" ||
    value === "last3" ||
    value === "last30" ||
    value === "currentMonth" ||
    value === "lastMonth" ||
    value === "cycleWaiver" ||
    value === "newCustomerGift" ||
    value === "lastCycle" ||
    value === "cycle"
    ? value
    : "cycle";
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const adminSession = await getCurrentAdminSession();

  if (!adminSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const period = parseTrafficBoardPeriod(searchParams.get("period"));
  const traceId = searchParams.get("traceId");
  const requestDebug = {
    traceId,
    adminUsername: adminSession.username,
    customerId,
    period,
  };

  console.info(`Traffic board row API request started ${stringifyTrafficBoardRouteLog(requestDebug)}`);

  if (!customerId) {
    console.warn(
      `Traffic board row API request failed ${stringifyTrafficBoardRouteLog({
        ...requestDebug,
        reason: "missing_customer_id",
        durationMs: Date.now() - startedAt,
      })}`,
    );
    return NextResponse.json(
      { message: getApiMessage(locale, "customerAccessDenied") },
      { status: 400 },
    );
  }

  const row = await getTrafficBoardRow(locale, adminSession, customerId, period, new Date(), traceId ?? undefined);

  if (!row) {
    console.warn(
      `Traffic board row API request failed ${stringifyTrafficBoardRouteLog({
        ...requestDebug,
        reason: "customer_not_found_or_forbidden",
        durationMs: Date.now() - startedAt,
      })}`,
    );
    return NextResponse.json(
      { message: getApiMessage(locale, "customerAccessDenied") },
      { status: 404 },
    );
  }

  console.info(
    `Traffic board row API request finished ${stringifyTrafficBoardRouteLog({
      ...requestDebug,
      customerName: row.customerName,
      hasLiveData: row.hasLiveData,
      traffic: row.traffic,
      trafficGb: row.trafficGb,
      trafficHint: row.trafficHint,
      durationMs: Date.now() - startedAt,
    })}`,
  );

  return NextResponse.json(row);
}
