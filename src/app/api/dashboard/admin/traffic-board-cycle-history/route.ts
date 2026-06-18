import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { getTrafficBoardCycleHistory } from "@/lib/mock-backend";

function stringifyTrafficBoardHistoryRouteLog(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
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
  const requestDebug = {
    adminUsername: adminSession.username,
    customerId,
  };

  if (!customerId) {
    return NextResponse.json({ message: getApiMessage(locale, "customerAccessDenied") }, { status: 400 });
  }

  console.info(`Traffic board cycle history request started ${stringifyTrafficBoardHistoryRouteLog(requestDebug)}`);

  const history = await getTrafficBoardCycleHistory(locale, adminSession, customerId, new Date());

  if (!history) {
    console.warn(
      `Traffic board cycle history request failed ${stringifyTrafficBoardHistoryRouteLog({
        ...requestDebug,
        reason: "customer_not_found_or_forbidden",
        durationMs: Date.now() - startedAt,
      })}`,
    );
    return NextResponse.json({ message: getApiMessage(locale, "customerAccessDenied") }, { status: 404 });
  }

  console.info(
    `Traffic board cycle history request finished ${stringifyTrafficBoardHistoryRouteLog({
      ...requestDebug,
      entryCount: history.entries.length,
      durationMs: Date.now() - startedAt,
    })}`,
  );

  return NextResponse.json(history);
}
