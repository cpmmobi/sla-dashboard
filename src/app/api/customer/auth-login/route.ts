import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiMessage, normalizeLocale } from "@/lib/i18n";
import { authenticateCustomer } from "@/lib/mock-backend";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("sla_locale")?.value);
  const body = await request.json().catch(() => null);
  const authCode = typeof body?.authCode === "string" ? body.authCode.trim() : "";

  const customer = await authenticateCustomer(authCode);

  if (!customer) {
    return NextResponse.json(
      { message: getApiMessage(locale, "invalidCustomerAuth") },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    redirectUrl: `/c/${encodeURIComponent(customer.authCode)}`,
    customer: {
      id: customer.id,
      name: customer.name,
      domains: customer.domains,
    },
  });

  response.cookies.set("sla_customer_auth", customer.authCode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
