import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { dismissAnnouncementForIp, getCustomerByAuth } from "@/lib/mock-backend";
import { getRequestIp } from "@/lib/request-ip";

export async function POST(request: Request) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const body = await request.json().catch(() => null);
  const announcementId = typeof body?.announcementId === "string" ? body.announcementId.trim() : "";
  const authCode = typeof body?.authCode === "string" ? body.authCode.trim() : "";

  if (!announcementId || !authCode) {
    return NextResponse.json(
      { message: getApiMessage(locale, "announcementNotFound") },
      { status: 400 },
    );
  }

  const customer = await getCustomerByAuth(authCode);
  if (!customer || customer.status !== "正常") {
    return NextResponse.json(
      { message: getApiMessage(locale, "dashboardNotFound") },
      { status: 404 },
    );
  }

  try {
    await dismissAnnouncementForIp({
      announcementId,
      ipAddress: getRequestIp(requestHeaders),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "ANNOUNCEMENT_NOT_FOUND"
        ? getApiMessage(locale, "announcementNotFound")
        : getApiMessage(locale, "updateAnnouncementFailed");

    return NextResponse.json({ message }, { status: 400 });
  }
}
