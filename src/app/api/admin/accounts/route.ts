import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { createAdminAccount, getManagedAdminAccounts } from "@/lib/mock-backend";

function parseAdminRole(value: unknown) {
  return value === "account_manager" ? "account_manager" : "super_admin";
}

export async function GET() {
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

  const accounts = await getManagedAdminAccounts(adminSession, locale);

  return NextResponse.json({
    accounts,
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

  if (adminSession.role !== "super_admin") {
    return NextResponse.json({ message: getApiMessage(locale, "adminOnly") }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const payload = {
    username: typeof body?.username === "string" ? body.username.trim() : "",
    displayName: typeof body?.displayName === "string" ? body.displayName.trim() : "",
    password: typeof body?.password === "string" ? body.password : "",
    role: parseAdminRole(body?.role),
  } as const;

  if (!payload.username || !payload.displayName || !payload.password) {
    return NextResponse.json(
      { message: getApiMessage(locale, "adminRequiredFields") },
      { status: 400 },
    );
  }

  try {
    const account = await createAdminAccount({
      adminSession,
      ...payload,
    });

    return NextResponse.json({
      ok: true,
      account,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? getApiMessage(locale, "duplicateAdminUsername")
        : getApiMessage(locale, "createAdminFailed");

    return NextResponse.json({ message }, { status: 400 });
  }
}
