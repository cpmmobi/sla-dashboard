import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { deleteAnnouncement, updateAnnouncement } from "@/lib/mock-backend";

function getAnnouncementErrorMessage(
  locale: ReturnType<typeof normalizeLocale>,
  error: unknown,
  fallbackKey: "updateAnnouncementFailed" | "deleteAnnouncementFailed",
) {
  if (!(error instanceof Error)) {
    return getApiMessage(locale, fallbackKey);
  }

  if (error.message === "ANNOUNCEMENT_REQUIRED_FIELDS") {
    return getApiMessage(locale, "announcementRequiredFields");
  }

  if (error.message === "ANNOUNCEMENT_INVALID_RANGE") {
    return getApiMessage(locale, "announcementInvalidRange");
  }

  if (error.message === "ANNOUNCEMENT_NOT_FOUND") {
    return getApiMessage(locale, "announcementNotFound");
  }

  return getApiMessage(locale, fallbackKey);
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
    titleZh: typeof body?.titleZh === "string" ? body.titleZh : "",
    titleEn: typeof body?.titleEn === "string" ? body.titleEn : "",
    contentZh: typeof body?.contentZh === "string" ? body.contentZh : "",
    contentEn: typeof body?.contentEn === "string" ? body.contentEn : "",
    startsAt: typeof body?.startsAt === "string" ? body.startsAt : null,
    endsAt: typeof body?.endsAt === "string" ? body.endsAt : null,
    enabled: body?.enabled !== false,
  } as const;

  try {
    const announcement = await updateAnnouncement(id, {
      adminSession,
      ...payload,
    });

    return NextResponse.json({
      ok: true,
      announcement,
    });
  } catch (error) {
    const message = getAnnouncementErrorMessage(locale, error, "updateAnnouncementFailed");

    return NextResponse.json(
      { message },
      { status: error instanceof Error && error.message === "ANNOUNCEMENT_NOT_FOUND" ? 404 : 400 },
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

  const { id } = await context.params;

  try {
    const announcement = await deleteAnnouncement(id, adminSession);

    return NextResponse.json({
      ok: true,
      announcement,
    });
  } catch (error) {
    const message = getAnnouncementErrorMessage(locale, error, "deleteAnnouncementFailed");

    return NextResponse.json(
      { message },
      { status: error instanceof Error && error.message === "ANNOUNCEMENT_NOT_FOUND" ? 404 : 400 },
    );
  }
}
