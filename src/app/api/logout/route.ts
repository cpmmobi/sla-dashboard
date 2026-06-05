import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));

  response.cookies.delete("sla_admin_user");
  response.cookies.delete("sla_customer_auth");

  return response;
}
