"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getTranslations, Locale } from "@/lib/i18n";
import type { AdminSession } from "@/lib/mock-backend";

type FormState = {
  name: string;
  domainsText: string;
  authCode: string;
  status: "正常" | "待审查";
  accountManagerEmail: string;
  renewalDay: string;
  monthlyGiftCreditUsd: string;
  cumulativeGiftCreditUsd: string;
  cumulativeRechargeUsd: string;
  trafficMarkupPercent: string;
  notes: string;
};

function buildInitialState(currentAdmin: AdminSession): FormState {
  return {
    name: "",
    domainsText: "",
    authCode: "",
    status: "正常",
    accountManagerEmail: currentAdmin.role === "account_manager" ? currentAdmin.username : "",
    renewalDay: "",
    monthlyGiftCreditUsd: "",
    cumulativeGiftCreditUsd: "",
    cumulativeRechargeUsd: "",
    trafficMarkupPercent: "",
    notes: "",
  };
}

function parseRenewalDay(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseGiftCreditUsd(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

function parseTrafficMarkupPercent(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

export function AdminCustomerForm({
  locale,
  currentAdmin,
  onSuccess,
}: {
  locale: Locale;
  currentAdmin: AdminSession;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const t = getTranslations(locale);
  const [form, setForm] = useState<FormState>(() => buildInitialState(currentAdmin));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isAccountManager = currentAdmin.role === "account_manager";

  const authPreview = useMemo(() => {
    if (form.authCode.trim()) {
      return form.authCode.trim();
    }

    return "sl_auth_customer_001";
  }, [form.authCode]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          domains: parseDomains(form.domainsText),
          renewalDay: parseRenewalDay(form.renewalDay),
          monthlyGiftCreditUsd: parseGiftCreditUsd(form.monthlyGiftCreditUsd),
          cumulativeGiftCreditUsd: parseGiftCreditUsd(form.cumulativeGiftCreditUsd),
          cumulativeRechargeUsd: parseGiftCreditUsd(form.cumulativeRechargeUsd),
          ...(isAccountManager
            ? {}
            : {
                trafficMarkupPercent: parseTrafficMarkupPercent(form.trafficMarkupPercent),
              }),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.message ?? t.customerForm.saveFailed);
        return;
      }

      setSuccess(t.customerForm.createdSuccess(payload.customer.name));
      setForm(buildInitialState(currentAdmin));
      router.refresh();
      onSuccess?.();
    } catch {
      setError(t.customerForm.serviceUnavailable);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t.customerForm.labels.name}>
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder={t.customerForm.placeholders.name}
            className={inputClassName()}
          />
        </Field>
        <Field label={t.customerForm.labels.domains}>
          <textarea
            value={form.domainsText}
            onChange={(event) => updateField("domainsText", event.target.value)}
            placeholder={t.customerForm.placeholders.domains}
            rows={4}
            className={`${inputClassName()} resize-none`}
          />
        </Field>
        <Field label={t.customerForm.labels.authCode}>
          <input
            value={form.authCode}
            onChange={(event) => updateField("authCode", event.target.value)}
            placeholder={t.customerForm.placeholders.authCode}
            className={inputClassName()}
          />
        </Field>
        <Field label={t.customerForm.labels.status}>
          <select
            value={form.status}
            onChange={(event) => updateField("status", event.target.value as FormState["status"])}
            className={inputClassName()}
          >
            <option value="正常" className="bg-slate-900">
              {t.common.statuses["正常"]}
            </option>
            <option value="待审查" className="bg-slate-900">
              {t.common.statuses["待审查"]}
            </option>
          </select>
        </Field>
        <Field label={t.customerForm.labels.accountManagerEmail}>
          <input
            type="email"
            value={form.accountManagerEmail}
            disabled={isAccountManager}
            onChange={(event) => updateField("accountManagerEmail", event.target.value)}
            placeholder={t.customerForm.placeholders.accountManagerEmail}
            className={`${inputClassName()} disabled:bg-slate-50 disabled:text-slate-500`}
          />
        </Field>
        <Field label={t.customerForm.labels.renewalDay}>
          <input
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            value={form.renewalDay}
            onChange={(event) => updateField("renewalDay", event.target.value)}
            placeholder={t.customerForm.placeholders.renewalDay}
            className={inputClassName()}
          />
        </Field>
        <Field label={t.customerForm.labels.monthlyGiftCreditUsd}>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={form.monthlyGiftCreditUsd}
            onChange={(event) => updateField("monthlyGiftCreditUsd", event.target.value)}
            placeholder={t.customerForm.placeholders.monthlyGiftCreditUsd}
            className={inputClassName()}
          />
        </Field>
        <Field label={t.customerForm.labels.cumulativeGiftCreditUsd}>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={form.cumulativeGiftCreditUsd}
            onChange={(event) => updateField("cumulativeGiftCreditUsd", event.target.value)}
            placeholder={t.customerForm.placeholders.cumulativeGiftCreditUsd}
            className={inputClassName()}
          />
        </Field>
        <Field label={t.customerForm.labels.cumulativeRechargeUsd}>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={form.cumulativeRechargeUsd}
            onChange={(event) => updateField("cumulativeRechargeUsd", event.target.value)}
            placeholder={t.customerForm.placeholders.cumulativeRechargeUsd}
            className={inputClassName()}
          />
        </Field>
        {!isAccountManager ? (
          <Field label={t.customerForm.labels.trafficMarkupPercent}>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.trafficMarkupPercent}
              onChange={(event) => updateField("trafficMarkupPercent", event.target.value)}
              placeholder={t.customerForm.placeholders.trafficMarkupPercent}
              className={inputClassName()}
            />
          </Field>
        ) : null}
      </div>

      {isAccountManager ? (
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t.customerForm.accountManagerLockedHint}
        </div>
      ) : null}

      {!isAccountManager ? (
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t.customerForm.trafficMarkupHint}
        </div>
      ) : null}

      <Field label={t.customerForm.labels.notes}>
        <textarea
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          placeholder={t.customerForm.placeholders.notes}
          rows={4}
          className={`${inputClassName()} resize-none`}
        />
      </Field>

      <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {t.customerForm.authPreview}: <span className="font-medium">{authPreview}</span>
      </div>

      {error ? (
        <div className="rounded-[22px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? t.customerForm.saving : t.customerForm.save}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(buildInitialState(currentAdmin));
            setError("");
            setSuccess("");
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {t.customerForm.reset}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white";
}

function parseDomains(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n|,|，/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
