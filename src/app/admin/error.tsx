"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isEnglish = typeof document !== "undefined" && document.documentElement.lang.startsWith("en");

  useEffect(() => {
    console.error("Admin page render failed", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel rounded-[36px] p-6 sm:p-8 lg:p-10">
        <p className="text-[11px] uppercase tracking-[0.38em] text-rose-600">SportLiveAPI</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[0.01em] text-slate-950">
          {isEnglish ? "This page couldn't load" : "页面加载失败"}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
          {isEnglish
            ? "A temporary server error occurred while opening the admin console. Please try again."
            : "打开管理后台时遇到临时服务异常，请重试。"}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
          >
            {isEnglish ? "Reload" : "重新加载"}
          </button>
          <a
            href="/"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:text-rose-600"
          >
            {isEnglish ? "Back to login" : "返回登录"}
          </a>
        </div>
      </section>
    </main>
  );
}
