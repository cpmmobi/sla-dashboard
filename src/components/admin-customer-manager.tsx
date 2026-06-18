"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DashboardModal } from "@/components/dashboard-ui";
import { getStatusLabel, getTranslations, Locale } from "@/lib/i18n";
import type {
  AdminSession,
  CustomerReportAccessLogRecord,
  ManagedCustomerRecord,
} from "@/lib/mock-backend";

type FormState = {
  name: string;
  domainsText: string;
  authCode: string;
  status: "正常" | "待审查" | "停用";
  accountManagerEmail: string;
  renewalDay: string;
  monthlyGiftCreditUsd: string;
  cumulativeGiftCreditUsd: string;
  availableRechargeUsd: string;
  cumulativeRechargeUsd: string;
  trafficMarkupPercent: string;
  notes: string;
};

function buildForm(customer: ManagedCustomerRecord): FormState {
  return {
    name: customer.name,
    domainsText: customer.domains.join("\n"),
    authCode: customer.authCode,
    status: customer.status,
    accountManagerEmail: customer.accountManagerEmail ?? "",
    renewalDay: customer.renewalDay ? String(customer.renewalDay) : "",
    monthlyGiftCreditUsd: customer.monthlyGiftCreditUsd ? String(customer.monthlyGiftCreditUsd) : "",
    cumulativeGiftCreditUsd: customer.cumulativeGiftCreditUsd ? String(customer.cumulativeGiftCreditUsd) : "",
    availableRechargeUsd: customer.availableRechargeUsd ? String(customer.availableRechargeUsd) : "",
    cumulativeRechargeUsd: customer.cumulativeRechargeUsd ? String(customer.cumulativeRechargeUsd) : "",
    trafficMarkupPercent: customer.trafficMarkupPercent ? String(customer.trafficMarkupPercent) : "",
    notes: customer.notes,
  };
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

function buildCustomerDashboardPath(authCode: string) {
  return `/c/${encodeURIComponent(authCode)}`;
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

function getLogButtonLabel(locale: Locale) {
  return locale === "en" ? "Logs" : "日志";
}

export function AdminCustomerManager({
  customers,
  locale,
  currentAdmin,
}: {
  customers: ManagedCustomerRecord[];
  locale: Locale;
  currentAdmin: AdminSession;
}) {
  const router = useRouter();
  const t = getTranslations(locale);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [logCustomerId, setLogCustomerId] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [customerLogs, setCustomerLogs] = useState<CustomerReportAccessLogRecord[]>([]);
  const [clearedUnreadCountMap, setClearedUnreadCountMap] = useState<Record<string, number>>({});
  const isSuperAdmin = currentAdmin.role === "super_admin";

  const editingCustomer = useMemo(
    () => customers.find((customer) => customer.id === editingId) ?? null,
    [customers, editingId],
  );
  const deletingCustomer = useMemo(
    () => customers.find((customer) => customer.id === deletingCustomerId) ?? null,
    [customers, deletingCustomerId],
  );
  const logCustomer = useMemo(
    () => customers.find((customer) => customer.id === logCustomerId) ?? null,
    [customers, logCustomerId],
  );

  function startEdit(customer: ManagedCustomerRecord) {
    setEditingId(customer.id);
    setForm(buildForm(customer));
    setError("");
    setSuccess("");
  }

  function closeEdit() {
    setEditingId(null);
    setForm(null);
    setError("");
  }

  function openDelete(customer: ManagedCustomerRecord) {
    setDeletingCustomerId(customer.id);
    setDeleteConfirmName("");
    setError("");
    setSuccess("");
  }

  function closeDelete() {
    setDeletingCustomerId(null);
    setDeleteConfirmName("");
  }

  function closeLogs() {
    setLogCustomerId(null);
    setCustomerLogs([]);
    setLogsError("");
    setLogsLoading(false);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function openCustomerDashboard(customer: ManagedCustomerRecord) {
    const dashboardPath = buildCustomerDashboardPath(customer.authCode);
    window.open(dashboardPath, "_blank", "noopener,noreferrer");
  }

  async function copyCustomerDashboardLink(customer: ManagedCustomerRecord) {
    try {
      const dashboardUrl = new URL(buildCustomerDashboardPath(customer.authCode), window.location.origin);
      await navigator.clipboard.writeText(dashboardUrl.toString());
      setError("");
      setSuccess(t.customerManager.copiedDashboardLink(customer.name));
    } catch {
      setSuccess("");
      setError(t.customerManager.copyDashboardLinkFailed);
    }
  }

  async function openLogs(customer: ManagedCustomerRecord) {
    setLogCustomerId(customer.id);
    setLogsLoading(true);
    setLogsError("");
    setCustomerLogs([]);

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}/report-access-logs`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        setLogsError(result.message ?? (locale === "en" ? "Failed to load logs." : "日志加载失败。"));
        return;
      }

      setCustomerLogs(Array.isArray(result.logs) ? result.logs : []);
      setClearedUnreadCountMap((current) => ({ ...current, [customer.id]: 0 }));
    } catch {
      setLogsError(locale === "en" ? "Failed to load logs." : "日志加载失败。");
    } finally {
      setLogsLoading(false);
    }
  }

  async function submitPatch(customerId: string, payload: FormState) {
    setLoadingId(customerId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          domains: parseDomains(payload.domainsText),
          renewalDay: parseRenewalDay(payload.renewalDay),
          monthlyGiftCreditUsd: parseGiftCreditUsd(payload.monthlyGiftCreditUsd),
          cumulativeGiftCreditUsd: parseGiftCreditUsd(payload.cumulativeGiftCreditUsd),
          availableRechargeUsd: parseGiftCreditUsd(payload.availableRechargeUsd),
          cumulativeRechargeUsd: parseGiftCreditUsd(payload.cumulativeRechargeUsd),
          ...(isSuperAdmin
            ? {
                trafficMarkupPercent: parseTrafficMarkupPercent(payload.trafficMarkupPercent),
              }
            : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? t.customerManager.updateFailed);
        return;
      }

      setSuccess(t.customerManager.updatedSuccess(result.customer.name));
      closeEdit();
      router.refresh();
    } catch {
      setError(t.customerManager.serviceUnavailable);
    } finally {
      setLoadingId(null);
    }
  }

  async function toggleStatus(customer: ManagedCustomerRecord) {
    const nextStatus = customer.status === "停用" ? "正常" : "停用";
    await submitPatch(customer.id, {
      name: customer.name,
      domainsText: customer.domains.join("\n"),
      authCode: customer.authCode,
      status: nextStatus,
      accountManagerEmail: customer.accountManagerEmail ?? "",
      renewalDay: customer.renewalDay ? String(customer.renewalDay) : "",
      monthlyGiftCreditUsd: customer.monthlyGiftCreditUsd ? String(customer.monthlyGiftCreditUsd) : "",
      cumulativeGiftCreditUsd: customer.cumulativeGiftCreditUsd ? String(customer.cumulativeGiftCreditUsd) : "",
      availableRechargeUsd: customer.availableRechargeUsd ? String(customer.availableRechargeUsd) : "",
      cumulativeRechargeUsd: customer.cumulativeRechargeUsd ? String(customer.cumulativeRechargeUsd) : "",
      trafficMarkupPercent: customer.trafficMarkupPercent ? String(customer.trafficMarkupPercent) : "",
      notes: customer.notes,
    });
  }

  async function confirmDelete(customer: ManagedCustomerRecord) {
    if (deleteConfirmName.trim() !== customer.name) {
      setError(t.customerManager.deleteInputMismatch);
      return;
    }

    setLoadingId(customer.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? t.customerManager.deleteFailed);
        return;
      }

      setSuccess(t.customerManager.deletedSuccess(result.customer.name));
      closeDelete();
      if (editingId === customer.id) {
        closeEdit();
      }
      router.refresh();
    } catch {
      setError(t.customerManager.serviceUnavailable);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {success ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[22px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {customers.map((customer) => (
          <div
            key={customer.id}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base font-semibold text-slate-950">{customer.name}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      customer.status === "正常"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : customer.status === "停用"
                          ? "border border-rose-200 bg-rose-50 text-rose-700"
                          : "border border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {getStatusLabel(customer.status, locale)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                    {t.customerManager.recentUpdated}: {customer.updatedAt}
                  </span>
                  {customer.lastReportAccessAt ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                      {locale === "en" ? "Last report visit" : "最近查看报表"}: {customer.lastReportAccessAt}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    {t.customerManager.labels.domains}: <span className="text-slate-950">{customer.domains.join(", ")}</span>
                  </div>
                  <div>
                    {t.customerManager.labels.authCode}: <span className="text-slate-950">{customer.authCode}</span>
                  </div>
                  <div>
                    {t.customerManager.labels.accountManagerEmail}:{" "}
                    <span className="text-slate-950">
                      {customer.accountManagerEmail ?? t.customerManager.unassignedManager}
                    </span>
                  </div>
                  <div>
                    {t.customerManager.labels.renewalDay}:{" "}
                    <span className="text-slate-950">
                      {customer.renewalDay
                        ? t.customerManager.renewalDayValue(customer.renewalDay)
                        : t.customerManager.unsetRenewalDay}
                    </span>
                  </div>
                  <div>
                    {t.customerManager.labels.monthlyGiftCreditUsd}:{" "}
                    <span className="text-slate-950">
                      {customer.monthlyGiftCreditUsd
                        ? `${customer.monthlyGiftCreditUsd.toFixed(2)} USD`
                        : t.customerManager.noGiftCredit}
                    </span>
                  </div>
                  <div>
                    {t.customerManager.labels.cumulativeGiftCreditUsd}:{" "}
                    <span className="text-slate-950">
                      {customer.cumulativeGiftCreditUsd
                        ? `${customer.cumulativeGiftCreditUsd.toFixed(2)} USD`
                        : t.customerManager.noGiftCredit}
                    </span>
                  </div>
                  <div>
                    {t.customerManager.labels.availableRechargeUsd}:{" "}
                    <span className="text-slate-950">
                      {customer.availableRechargeUsd
                        ? `${customer.availableRechargeUsd.toFixed(2)} USD`
                        : t.customerManager.noGiftCredit}
                    </span>
                  </div>
                  <div>
                    {t.customerManager.labels.cumulativeRechargeUsd}:{" "}
                    <span className="text-slate-950">
                      {customer.cumulativeRechargeUsd
                        ? `${customer.cumulativeRechargeUsd.toFixed(2)} USD`
                        : t.customerManager.noGiftCredit}
                    </span>
                  </div>
                  {isSuperAdmin ? (
                    <div>
                      {t.customerManager.labels.trafficMarkupPercent}:{" "}
                      <span className="text-slate-950">
                        {customer.trafficMarkupPercent
                          ? `${customer.trafficMarkupPercent.toFixed(2)}%`
                          : t.customerManager.noTrafficMarkupPercent}
                      </span>
                    </div>
                  ) : null}
                  <div>
                    {t.customerManager.labels.domainCount(customer.domains.length)}
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-500">{customer.notes}</p>
              </div>

              <div className="flex flex-wrap items-start justify-end gap-3 lg:max-w-[320px]">
                <button
                  type="button"
                  onClick={() => openLogs(customer)}
                  className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {getLogButtonLabel(locale)}
                  {(clearedUnreadCountMap[customer.id] ?? customer.reportAccessUnreadCount) > 0 ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => openCustomerDashboard(customer)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {t.customerManager.openDashboard}
                </button>
                <button
                  type="button"
                  onClick={() => copyCustomerDashboardLink(customer)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {t.customerManager.copyDashboardLink}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(customer)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {t.customerManager.edit}
                </button>
                <button
                  type="button"
                  disabled={loadingId === customer.id}
                  onClick={() => openDelete(customer)}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {t.customerManager.delete}
                </button>
                <button
                  type="button"
                  disabled={loadingId === customer.id}
                  onClick={() => toggleStatus(customer)}
                  className="self-center px-1 py-0.5 text-xs font-medium text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingId === customer.id
                    ? t.customerManager.processing
                    : customer.status === "停用"
                      ? t.customerManager.restore
                      : t.customerManager.disable}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DashboardModal open={Boolean(editingCustomer && form)} onClose={closeEdit}>
        {editingCustomer && form ? (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {t.customerManager.editEyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">
                  {t.customerManager.editTitle(editingCustomer.name)}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.customerManager.close}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder={t.customerManager.placeholders.name}
                className={inputClassName()}
              />
              <input
                value={form.authCode}
                onChange={(event) => updateField("authCode", event.target.value)}
                placeholder={t.customerManager.placeholders.authCode}
                className={inputClassName()}
              />
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as FormState["status"])}
                className={inputClassName()}
              >
                <option value="正常" className="bg-white">
                  {t.common.statuses["正常"]}
                </option>
                <option value="待审查" className="bg-white">
                  {t.common.statuses["待审查"]}
                </option>
                <option value="停用" className="bg-white">
                  {t.common.statuses["停用"]}
                </option>
              </select>
              <input
                type="email"
                value={form.accountManagerEmail}
                disabled={!isSuperAdmin}
                onChange={(event) => updateField("accountManagerEmail", event.target.value)}
                placeholder={t.customerManager.placeholders.accountManagerEmail}
                className={`${inputClassName()} disabled:bg-slate-50 disabled:text-slate-500`}
              />
              <input
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={form.renewalDay}
                onChange={(event) => updateField("renewalDay", event.target.value)}
                placeholder={t.customerManager.placeholders.renewalDay}
                className={inputClassName()}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.monthlyGiftCreditUsd}
                onChange={(event) => updateField("monthlyGiftCreditUsd", event.target.value)}
                placeholder={t.customerManager.placeholders.monthlyGiftCreditUsd}
                className={inputClassName()}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.cumulativeGiftCreditUsd}
                onChange={(event) => updateField("cumulativeGiftCreditUsd", event.target.value)}
                placeholder={t.customerManager.placeholders.cumulativeGiftCreditUsd}
                className={inputClassName()}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-label={t.customerManager.labels.availableRechargeUsd}
                value={form.availableRechargeUsd}
                onChange={(event) => updateField("availableRechargeUsd", event.target.value)}
                placeholder={t.customerManager.placeholders.availableRechargeUsd}
                className={inputClassName()}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-label={t.customerManager.labels.cumulativeRechargeUsd}
                value={form.cumulativeRechargeUsd}
                onChange={(event) => updateField("cumulativeRechargeUsd", event.target.value)}
                placeholder={t.customerManager.placeholders.cumulativeRechargeUsd}
                className={inputClassName()}
              />
              {isSuperAdmin ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.trafficMarkupPercent}
                  onChange={(event) => updateField("trafficMarkupPercent", event.target.value)}
                  placeholder={t.customerManager.placeholders.trafficMarkupPercent}
                  className={inputClassName()}
                />
              ) : null}
            </div>

            {isSuperAdmin ? (
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {t.customerManager.trafficMarkupHint}
              </div>
            ) : null}

            <textarea
              value={form.domainsText}
              onChange={(event) => updateField("domainsText", event.target.value)}
              rows={4}
              placeholder={t.customerManager.placeholders.domains}
              className={`${inputClassName()} mt-4 resize-none`}
            />

            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              placeholder={t.customerManager.placeholders.notes}
              className={`${inputClassName()} mt-4 resize-none`}
            />

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={loadingId === editingCustomer.id}
                onClick={() => submitPatch(editingCustomer.id, form)}
                className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingId === editingCustomer.id ? t.customerManager.saving : t.customerManager.save}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.customerManager.cancel}
              </button>
            </div>
          </>
        ) : null}
      </DashboardModal>

      <DashboardModal open={Boolean(deletingCustomer)} onClose={closeDelete}>
        {deletingCustomer ? (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {t.customerManager.deleteEyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">
                  {t.customerManager.deleteTitle(deletingCustomer.name)}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDelete}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.customerManager.close}
              </button>
            </div>

            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
              {t.customerManager.deleteDescription}
            </div>

            <div className="mt-4 space-y-2 rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-600">
              <p>
                {t.customerManager.labels.domains}:{" "}
                <span className="text-slate-950">{deletingCustomer.domains.join(", ")}</span>
              </p>
              <p>
                {t.customerManager.labels.authCode}:{" "}
                <span className="text-slate-950">{deletingCustomer.authCode}</span>
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t.customerManager.deleteInputLabel}
              </label>
              <input
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                placeholder={t.customerManager.deleteInputPlaceholder}
                className={inputClassName()}
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={
                  loadingId === deletingCustomer.id ||
                  deleteConfirmName.trim() !== deletingCustomer.name
                }
                onClick={() => confirmDelete(deletingCustomer)}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingId === deletingCustomer.id
                  ? t.customerManager.processing
                  : t.customerManager.confirmDelete}
              </button>
              <button
                type="button"
                onClick={closeDelete}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.customerManager.cancel}
              </button>
            </div>
          </>
        ) : null}
      </DashboardModal>

      <DashboardModal open={Boolean(logCustomer)} onClose={closeLogs}>
        {logCustomer ? (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  {locale === "en" ? "ACCESS LOGS" : "访问日志"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">
                  {locale === "en" ? `${logCustomer.name} Report Logs` : `${logCustomer.name} 的报表日志`}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeLogs}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.customerManager.close}
              </button>
            </div>

            <div className="mb-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {locale === "en"
                ? `Recent customer-side report visits. Total records: ${logCustomer.reportAccessTotalCount}.`
                : `这里展示客户侧最近访问流量报表的记录，当前累计 ${logCustomer.reportAccessTotalCount} 条。`}
            </div>

            {logsError ? (
              <div className="rounded-[22px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                {logsError}
              </div>
            ) : null}

            {logsLoading ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {locale === "en" ? "Loading logs..." : "正在加载日志..."}
              </div>
            ) : customerLogs.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {locale === "en" ? "No report access logs yet." : "暂时还没有客户查看报表的日志。"}
              </div>
            ) : (
              <div className="space-y-3">
                {customerLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-slate-950">{log.accessedAt}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                        IP: {log.ipAddress}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-xs leading-5 text-slate-500">
                      {log.userAgent ?? (locale === "en" ? "Unknown device" : "未知设备")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </DashboardModal>
    </div>
  );
}
