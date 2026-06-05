import { AdminLoginForm } from "@/components/auth-forms";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getTranslations } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/locale";

export default async function Home() {
  const locale = await getCurrentLocale();
  const t = getTranslations(locale);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel rounded-[36px] p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-rose-600">{t.common.brand}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[0.01em] text-slate-950 sm:text-4xl">
              {t.home.title}
            </h1>
          </div>
          <LocaleSwitcher locale={locale} />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="panel panel-strong rounded-[30px] p-6 sm:p-7">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{t.home.adminAccessEyebrow}</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-slate-950 sm:text-3xl">
                {t.home.adminAccessTitle}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
                {locale === "en"
                  ? "Use this console to manage customers, review traffic reports, inspect traffic board trends, and handle daily operations in one place."
                  : "该首页仅面向管理员使用，可集中完成客户管理、流量报表查询、大盘巡检与日常运营处理。"}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#admin-access"
                  className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
                >
                  {t.home.adminCta}
                </a>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {t.home.cards.map(([title, desc]) => (
                <div key={title} className="panel panel-strong rounded-[26px] p-5">
                  <p className="text-base font-semibold text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="admin-access" className="panel panel-strong rounded-[30px] p-6 sm:p-7">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{t.home.adminAccessEyebrow}</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{t.home.adminAccessTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {locale === "en"
                ? "Sign in to enter the operations console."
                : "登录后进入运营后台。"}
            </p>
            <div className="mt-6">
              <AdminLoginForm locale={locale} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
