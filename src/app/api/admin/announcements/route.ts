import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { createAnnouncement, getManagedAnnouncements } from "@/lib/mock-backend";

function getAnnouncementErrorMessage(locale: ReturnType<typeof normalizeLocale>, error: unknown) {
  if (!(error instanceof Error)) {
    return getApiMessage(locale, "createAnnouncementFailed");
  }

  if (error.message === "ANNOUNCEMENT_REQUIRED_FIELDS") {
    return getApiMessage(locale, "announcementRequiredFields");
  }

  if (error.message === "ANNOUNCEMENT_INVALID_RANGE") {
    return getApiMessage(locale, "announcementInvalidRange");
  }

  return getApiMessage(locale, "createAnnouncementFailed");
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

  const announcements = await getManagedAnnouncements(adminSession);

  return NextResponse.json({
    announcements,
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
    titleZh: typeof body?.titleZh === "string" ? body.titleZh : "",
    titleEn: typeof body?.titleEn === "string" ? body.titleEn : "",
    contentZh: typeof body?.contentZh === "string" ? body.contentZh : "",
    contentEn: typeof body?.contentEn === "string" ? body.contentEn : "",
    startsAt: typeof body?.startsAt === "string" ? body.startsAt : null,
    endsAt: typeof body?.endsAt === "string" ? body.endsAt : null,
    enabled: body?.enabled !== false,
  } as const;

  try {
    const announcement = await createAnnouncement({
      adminSession,
      ...payload,
    });

    return NextResponse.json({
      ok: true,
      announcement,
    });
  } catch (error) {
    return NextResponse.json(
      { message: getAnnouncementErrorMessage(locale, error) },
      { status: 400 },
    );
  }
}
