import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { updateAdminAccount } from "@/lib/mock-backend";

function isDuplicateConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function parseAdminRole(value: unknown) {
  return value === "account_manager" ? "account_manager" : "super_admin";
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

  if (adminSession.role !== "super_admin") {
    return NextResponse.json({ message: getApiMessage(locale, "adminOnly") }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const payload = {
    username: typeof body?.username === "string" ? body.username.trim() : "",
    displayName: typeof body?.displayName === "string" ? body.displayName.trim() : "",
    password: typeof body?.password === "string" ? body.password : "",
    role: parseAdminRole(body?.role),
  } as const;

  if (!payload.username || !payload.displayName) {
    return NextResponse.json(
      { message: getApiMessage(locale, "adminRequiredFields") },
      { status: 400 },
    );
  }

  try {
    const account = await updateAdminAccount(id, {
      adminSession,
      ...payload,
      password: payload.password || undefined,
    });

    return NextResponse.json({
      ok: true,
      account,
    });
  } catch (error) {
    const message =
      isDuplicateConstraintError(error)
        ? getApiMessage(locale, "duplicateAdminUsername")
        : getApiMessage(locale, "updateAdminFailed");

    return NextResponse.json({ message }, { status: 400 });
  }
}
