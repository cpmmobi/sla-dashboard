"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getTranslations, Locale } from "@/lib/i18n";

function Field({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white"
      />
    </label>
  );
}

export function CustomerAuthForm({
  exampleAuth,
  locale,
}: {
  exampleAuth: string;
  locale: Locale;
}) {
  const router = useRouter();
  const t = getTranslations(locale);
  const [authCode, setAuthCode] = useState(exampleAuth);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/customer/auth-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ authCode }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.message ?? t.auth.customer.invalidAuth);
        return;
      }

      router.push(payload.redirectUrl);
    } catch {
      setError(t.auth.customer.unavailable);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label={t.auth.customer.fieldLabel}
        value={authCode}
        placeholder={t.auth.customer.fieldPlaceholder}
        onChange={setAuthCode}
      />

      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {t.auth.customer.exampleAuth}: <span className="font-medium">{exampleAuth}</span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? t.auth.customer.loading : t.auth.customer.submit}
      </button>
    </form>
  );
}

export function AdminLoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = getTranslations(locale);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.message ?? t.auth.admin.invalidCredentials);
        return;
      }

      router.push(payload.redirectUrl);
    } catch {
      setError(t.auth.admin.unavailable);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label={t.auth.admin.usernameLabel}
        value={username}
        placeholder={t.auth.admin.usernamePlaceholder}
        onChange={setUsername}
      />
      <Field
        label={t.auth.admin.passwordLabel}
        type="password"
        value={password}
        placeholder={t.auth.admin.passwordPlaceholder}
        onChange={setPassword}
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {t.auth.admin.hint}
      </div>

      {error ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? t.auth.admin.loading : t.auth.admin.submit}
      </button>
    </form>
  );
}
