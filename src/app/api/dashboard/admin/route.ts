import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAdminSession } from "@/lib/admin-auth";
import { normalizeLocale } from "@/lib/i18n";
import { getAdminView } from "@/lib/mock-backend";

export async function GET() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const adminSession = await getCurrentAdminSession();

  if (!adminSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getAdminView(locale, adminSession));
}
