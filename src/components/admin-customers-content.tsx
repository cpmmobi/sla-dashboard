"use client";

import { useState } from "react";
import { AdminCustomerForm } from "@/components/admin-customer-form";
import { AdminCustomerManager } from "@/components/admin-customer-manager";
import { DashboardModal, Panel } from "@/components/dashboard-ui";
import { getTranslations, Locale } from "@/lib/i18n";
import type { AdminSession, ManagedCustomerRecord } from "@/lib/mock-backend";

export function AdminCustomersContent({
  locale,
  customers,
  currentAdmin,
}: {
  locale: Locale;
  customers: ManagedCustomerRecord[];
  currentAdmin: AdminSession;
}) {
  const t = getTranslations(locale);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <>
      <Panel
        eyebrow={t.adminCustomersPage.customerListEyebrow}
        title={t.adminCustomersPage.customerListTitle}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
              {t.adminCustomersPage.customerCount(customers.length)}
            </span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
            >
              {t.adminCustomersPage.createTitle}
            </button>
          </div>
        }
      >
        <AdminCustomerManager customers={customers} locale={locale} currentAdmin={currentAdmin} />
      </Panel>

      <DashboardModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {t.adminCustomersPage.createEyebrow}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">
              {t.adminCustomersPage.createTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.customerManager.close}
          </button>
        </div>

        <AdminCustomerForm
          locale={locale}
          currentAdmin={currentAdmin}
          onSuccess={() => setIsCreateOpen(false)}
        />
      </DashboardModal>
    </>
  );
}
