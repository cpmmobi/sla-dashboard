import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { deleteCustomer, updateCustomer } from "@/lib/mock-backend";

function isDuplicateConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const adminSession = await getCurrentAdminSession();
  if (!adminSession) {
    return NextResponse.json(
      { message: getApiMessage(locale, "adminUnauthorized") },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const payload = {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    authCode: typeof body?.authCode === "string" ? body.authCode.trim() : "",
    domains: Array.isArray(body?.domains)
      ? (body.domains as unknown[])
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
      : [],
    status:
      body?.status === "待审查" || body?.status === "停用" ? body.status : "正常",
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
    const customer = await updateCustomer(id, {
      adminSession,
      ...payload,
    });

    return NextResponse.json({
      ok: true,
      customer,
    });
  } catch (error) {
    console.error("Failed to update customer", {
      id,
      payload,
      error,
    });

    const message =
      error instanceof Error && error.message === "CUSTOMER_NOT_FOUND"
        ? getApiMessage(locale, "customerAccessDenied")
        : isDuplicateConstraintError(error)
          ? getApiMessage(locale, "duplicateAuth")
          : getApiMessage(locale, "updateCustomerFailed");

    return NextResponse.json(
      { message },
      {
        status:
          error instanceof Error && error.message === "CUSTOMER_NOT_FOUND" ? 403 : 400,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const adminSession = await getCurrentAdminSession();
  if (!adminSession) {
    return NextResponse.json(
      { message: getApiMessage(locale, "adminUnauthorized") },
      { status: 401 },
    );
  }
  try {
    const { id } = await context.params;
    const customer = await deleteCustomer(id, adminSession);

    return NextResponse.json({
      ok: true,
      customer,
    });
  } catch (error) {
    console.error("Failed to delete customer", {
      error,
    });

    const message =
      error instanceof Error && error.message === "CUSTOMER_NOT_FOUND"
        ? getApiMessage(locale, "customerAccessDenied")
        : getApiMessage(locale, "deleteCustomerFailed");

    return NextResponse.json(
      { message },
      {
        status:
          error instanceof Error && error.message === "CUSTOMER_NOT_FOUND" ? 403 : 400,
      },
    );
  }
}
