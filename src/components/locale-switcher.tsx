"use client";

import { useRouter } from "next/navigation";
import { Locale } from "@/lib/i18n";

export function LocaleSwitcher({
  locale,
}: {
  locale: Locale;
}) {
  const router = useRouter();

  async function updateLocale(nextLocale: Locale) {
    if (nextLocale === locale) {
      return;
    }

    await fetch("/api/locale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locale: nextLocale }),
    });

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {[
        { code: "zh-CN" as const, label: "简体" },
        { code: "en" as const, label: "EN" },
      ].map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => updateLocale(item.code)}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            locale === item.code
              ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
