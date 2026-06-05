import { cookies } from "next/headers";
import { defaultLocale, localeCookieName, Locale, normalizeLocale } from "@/lib/i18n";

export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value ?? defaultLocale);
}
