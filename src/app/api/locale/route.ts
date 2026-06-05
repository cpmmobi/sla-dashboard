import { NextResponse } from "next/server";
import { defaultLocale, localeCookieName, normalizeLocale } from "@/lib/i18n";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const locale = normalizeLocale(typeof body?.locale === "string" ? body.locale : defaultLocale);

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(localeCookieName, locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
