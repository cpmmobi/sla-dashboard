import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { createCustomer, getCustomersForAdmin } from "@/lib/mock-backend";

export async function GET() {
  const adminSession = await getCurrentAdminSession();
  if (!adminSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const customers = await getCustomersForAdmin(adminSession);

  return NextResponse.json({
    customers,
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const adminSession = await getCurrentAdminSession();
  if (!adminSession) {
    return NextResponse.json(
      { message: getApiMessage(locale, "adminUnauthorized") },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => null);

  const payload = {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    authCode: typeof body?.authCode === "string" ? body.authCode.trim() : "",
    domains: Array.isArray(body?.domains)
      ? (body.domains as unknown[])
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
      : [],
    status: body?.status === "待审查" ? "待审查" : "正常",
    accountManagerEmail:
      typeof body?.accountManagerEmail === "string" ? body.accountManagerEmail.trim() : "",
    renewalDay: typeof body?.renewalDay === "number" ? body.renewalDay : null,
    monthlyGiftCreditUsd: typeof body?.monthlyGiftCreditUsd === "number" ? body.monthlyGiftCreditUsd : null,
    cumulativeGiftCreditUsd:
      typeof body?.cumulativeGiftCreditUsd === "number" ? body.cumulativeGiftCreditUsd : null,
    trafficMarkupPercent:
      typeof body?.trafficMarkupPercent === "number"
        ? body.trafficMarkupPercent
        : body?.trafficMarkupPercent === null
          ? null
          : undefined,
    notes: typeof body?.notes === "string" ? body.notes.trim() : "",
  } as const;

  if (!payload.name || !payload.authCode || payload.domains.length === 0) {
    return NextResponse.json(
      { message: getApiMessage(locale, "requiredCustomerFields") },
      { status: 400 },
    );
  }

  try {
    const customer = await createCustomer({
      adminSession,
      ...payload,
    });

    return NextResponse.json({
      ok: true,
      customer,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? getApiMessage(locale, "duplicateAuth")
        : getApiMessage(locale, "createCustomerFailed");

    return NextResponse.json({ message }, { status: 400 });
  }
}
