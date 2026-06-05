"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardModal, Panel } from "@/components/dashboard-ui";
import { getTranslations, Locale } from "@/lib/i18n";
import type { AdminRole, ManagedAdminAccount } from "@/lib/mock-backend";

type FormState = {
  username: string;
  displayName: string;
  role: AdminRole;
  password: string;
};

function inputClassName() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white";
}

function buildInitialState(): FormState {
  return {
    username: "",
    displayName: "",
    role: "account_manager",
    password: "",
  };
}

function buildEditState(account: ManagedAdminAccount): FormState {
  return {
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    password: "",
  };
}

export function AdminAccountManager({
  locale,
  accounts,
  currentUsername,
}: {
  locale: Locale;
  accounts: ManagedAdminAccount[];
  currentUsername: string;
}) {
  const router = useRouter();
  const t = getTranslations(locale);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(buildInitialState);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const editingAccount = useMemo(
    () => accounts.find((account) => account.id === editId) ?? null,
    [accounts, editId],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreate() {
    setForm(buildInitialState());
    setError("");
    setSuccess("");
    setEditId(null);
    setCreateOpen(true);
  }

  function openEdit(account: ManagedAdminAccount) {
    setForm(buildEditState(account));
    setError("");
    setSuccess("");
    setCreateOpen(false);
    setEditId(account.id);
  }

  function closeModal() {
    setCreateOpen(false);
    setEditId(null);
    setForm(buildInitialState());
    setError("");
  }

  async function submit(mode: "create" | "edit") {
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint =
        mode === "create" ? "/api/admin/accounts" : `/api/admin/accounts/${editingAccount?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(
          payload.message ??
            (mode === "create" ? t.adminAccountManager.createFailed : t.adminAccountManager.updateFailed),
        );
        return;
      }

      setSuccess(
        mode === "create"
          ? t.adminAccountManager.createdSuccess(payload.account.displayName)
          : t.adminAccountManager.updatedSuccess(payload.account.displayName),
      );
      closeModal();
      router.refresh();
    } catch {
      setError(t.adminAccountManager.serviceUnavailable);
    } finally {
      setIsLoading(false);
    }
  }

  const modalOpen = createOpen || Boolean(editingAccount);
  const isEditingSelf = editingAccount?.username === currentUsername;

  return (
    <Panel
      eyebrow={t.adminAccountsPage.accountListEyebrow}
      title={t.adminAccountsPage.accountListTitle}
      aside={
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            {t.adminAccountsPage.accountCount(accounts.length)}
          </span>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
          >
            {t.adminAccountManager.create}
          </button>
        </div>
      }
    >
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
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-base font-semibold text-slate-950">{account.displayName}</p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      {t.adminAccountManager.roles[account.role]}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                      {t.adminAccountManager.updatedAt}: {account.updatedAt}
                    </span>
                  </div>
                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div>
                      {t.adminAccountManager.labels.username}:{" "}
                      <span className="text-slate-950">{account.username}</span>
                    </div>
                    <div>
                      {t.adminAccountManager.labels.assignedCustomers}:{" "}
                      <span className="text-slate-950">
                        {t.adminAccountManager.assignedCustomers(account.assignedCustomerCount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-start justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(account)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {t.adminAccountManager.edit}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DashboardModal open={modalOpen} onClose={closeModal}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {createOpen ? t.adminAccountManager.createEyebrow : t.adminAccountManager.editEyebrow}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">
              {createOpen
                ? t.adminAccountManager.createTitle
                : t.adminAccountManager.editTitle(editingAccount?.displayName ?? "")}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.adminAccountManager.close}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            type="email"
            value={form.username}
            disabled={isEditingSelf}
            onChange={(event) => updateField("username", event.target.value)}
            placeholder={t.adminAccountManager.placeholders.username}
            className={`${inputClassName()} disabled:bg-slate-50 disabled:text-slate-500`}
          />
          <input
            value={form.displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            placeholder={t.adminAccountManager.placeholders.displayName}
            className={inputClassName()}
          />
          <select
            value={form.role}
            disabled={isEditingSelf}
            onChange={(event) => updateField("role", event.target.value as AdminRole)}
            className={`${inputClassName()} disabled:bg-slate-50 disabled:text-slate-500`}
          >
            <option value="super_admin" className="bg-white">
              {t.adminAccountManager.roles.super_admin}
            </option>
            <option value="account_manager" className="bg-white">
              {t.adminAccountManager.roles.account_manager}
            </option>
          </select>
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder={
              createOpen
                ? t.adminAccountManager.placeholders.password
                : t.adminAccountManager.placeholders.resetPassword
            }
            className={inputClassName()}
          />
        </div>

        {isEditingSelf ? (
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {t.adminAccountManager.selfRoleLocked}
          </div>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => submit(createOpen ? "create" : "edit")}
            className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? t.adminAccountManager.saving : createOpen ? t.adminAccountManager.create : t.adminAccountManager.save}
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.adminAccountManager.cancel}
          </button>
        </div>
      </DashboardModal>
    </Panel>
  );
}
