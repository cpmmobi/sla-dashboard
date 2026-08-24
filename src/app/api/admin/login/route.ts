import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { authenticateAdmin } from "@/lib/mock-backend";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  let session;
  try {
    session = await authenticateAdmin(username, password);
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json(
      { message: getApiMessage(locale, "adminLoginUnavailable") },
      { status: 503 },
    );
  }

  if (!session) {
    return NextResponse.json(
      { message: getApiMessage(locale, "invalidAdminCredentials") },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    redirectUrl: "/admin/reports",
    session,
  });

  response.cookies.set("sla_admin_user", session.username, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
