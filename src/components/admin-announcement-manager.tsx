"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnnouncementRichText } from "@/components/announcement-rich-text";
import { DashboardModal, Panel } from "@/components/dashboard-ui";
import { getTranslations, Locale } from "@/lib/i18n";
import type { AnnouncementStatus, ManagedAnnouncement } from "@/lib/mock-backend";

type FormState = {
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
};

function inputClassName() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white";
}

function textareaClassName() {
  return `${inputClassName()} min-h-56 resize-y`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildInitialState(): FormState {
  return {
    titleZh: "",
    titleEn: "",
    contentZh: "",
    contentEn: "",
    startsAt: "",
    endsAt: "",
    enabled: true,
  };
}

function buildEditState(announcement: ManagedAnnouncement): FormState {
  return {
    titleZh: announcement.titleZh,
    titleEn: announcement.titleEn,
    contentZh: announcement.contentZh,
    contentEn: announcement.contentEn,
    startsAt: toDateTimeLocal(announcement.startsAt),
    endsAt: toDateTimeLocal(announcement.endsAt),
    enabled: announcement.enabled,
  };
}

function formatDateTime(value: string | null, locale: Locale) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusClassName(status: AnnouncementStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "scheduled":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "expired":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "disabled":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export function AdminAnnouncementManager({
  locale,
  announcements,
}: {
  locale: Locale;
  announcements: ManagedAnnouncement[];
}) {
  const router = useRouter();
  const t = getTranslations(locale);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(buildInitialState);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === editId) ?? null,
    [announcements, editId],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreate() {
    setCreateOpen(true);
    setEditId(null);
    setForm(buildInitialState());
    setError("");
    setSuccess("");
  }

  function openEdit(announcement: ManagedAnnouncement) {
    setCreateOpen(false);
    setEditId(announcement.id);
    setForm(buildEditState(announcement));
    setError("");
    setSuccess("");
  }

  function closeModal() {
    setCreateOpen(false);
    setEditId(null);
    setForm(buildInitialState());
    setError("");
  }

  function getStatusLabel(status: AnnouncementStatus) {
    switch (status) {
      case "active":
        return t.adminAnnouncementManager.active;
      case "scheduled":
        return t.adminAnnouncementManager.scheduled;
      case "expired":
        return t.adminAnnouncementManager.expired;
      case "disabled":
      default:
        return t.adminAnnouncementManager.disabled;
    }
  }

  async function submit(mode: "create" | "edit") {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const endpoint =
        mode === "create"
          ? "/api/admin/announcements"
          : `/api/admin/announcements/${editingAnnouncement?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titleZh: form.titleZh,
          titleEn: form.titleEn,
          contentZh: form.contentZh,
          contentEn: form.contentEn,
          startsAt: toIsoOrNull(form.startsAt),
          endsAt: toIsoOrNull(form.endsAt),
          enabled: form.enabled,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(
          payload.message ??
            (mode === "create"
              ? t.adminAnnouncementManager.createFailed
              : t.adminAnnouncementManager.updateFailed),
        );
        return;
      }

      setSuccess(
        mode === "create"
          ? t.adminAnnouncementManager.createdSuccess
          : t.adminAnnouncementManager.updatedSuccess,
      );
      closeModal();
      router.refresh();
    } catch {
      setError(t.adminAnnouncementManager.serviceUnavailable);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeAnnouncement(announcement: ManagedAnnouncement) {
    if (!window.confirm(t.adminAnnouncementManager.deleteConfirm)) {
      return;
    }

    setDeletingId(announcement.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/announcements/${announcement.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.message ?? t.adminAnnouncementManager.deleteFailed);
        return;
      }

      setSuccess(t.adminAnnouncementManager.deletedSuccess);
      router.refresh();
    } catch {
      setError(t.adminAnnouncementManager.serviceUnavailable);
    } finally {
      setDeletingId(null);
    }
  }

  const modalOpen = createOpen || Boolean(editingAnnouncement);

  return (
    <Panel
      eyebrow={t.adminAnnouncementManager.eyebrow}
      title={t.adminAnnouncementManager.title}
      aside={
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            {announcements.length}
          </span>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
          >
            {t.adminAnnouncementManager.create}
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

        {announcements.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center text-sm text-slate-500">
            {t.adminAnnouncementManager.noAnnouncements}
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-950">{announcement.titleZh}</p>
                      <span className={`rounded-full border px-3 py-1 text-xs ${statusClassName(announcement.status)}`}>
                        {getStatusLabel(announcement.status)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                        {announcement.enabled
                          ? t.adminAnnouncementManager.enabled
                          : t.adminAnnouncementManager.disabled}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-600">{announcement.titleEn}</p>
                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <div>{t.adminAnnouncementManager.createdBy(announcement.createdByUsername ?? "-")}</div>
                      <div>{t.adminAnnouncementManager.createdAt(formatDateTime(announcement.createdAt, locale))}</div>
                      <div>{t.adminAnnouncementManager.updatedAt(formatDateTime(announcement.updatedAt, locale))}</div>
                      <div>
                        {t.adminAnnouncementManager.labels.startsAt}: {formatDateTime(announcement.startsAt, locale)}
                      </div>
                      <div>
                        {t.adminAnnouncementManager.labels.endsAt}: {formatDateTime(announcement.endsAt, locale)}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="mb-2 font-medium text-slate-950">{t.adminAnnouncementManager.labels.contentZh}</p>
                        <AnnouncementRichText content={announcement.contentZh} />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="mb-2 font-medium text-slate-950">{t.adminAnnouncementManager.labels.contentEn}</p>
                        <AnnouncementRichText content={announcement.contentEn} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => openEdit(announcement)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {t.customerManager.edit}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === announcement.id}
                      onClick={() => removeAnnouncement(announcement)}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deletingId === announcement.id
                        ? t.adminAnnouncementManager.deleting
                        : t.adminAnnouncementManager.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DashboardModal open={modalOpen} onClose={closeModal} maxWidthClassName="max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {createOpen
                ? t.adminAnnouncementManager.createEyebrow
                : t.adminAnnouncementManager.editEyebrow}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">
              {createOpen
                ? t.adminAnnouncementManager.createTitle
                : t.adminAnnouncementManager.editTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.adminAnnouncementManager.close}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={form.titleZh}
            onChange={(event) => updateField("titleZh", event.target.value)}
            placeholder={t.adminAnnouncementManager.placeholders.titleZh}
            className={inputClassName()}
          />
          <input
            value={form.titleEn}
            onChange={(event) => updateField("titleEn", event.target.value)}
            placeholder={t.adminAnnouncementManager.placeholders.titleEn}
            className={inputClassName()}
          />
          <textarea
            value={form.contentZh}
            onChange={(event) => updateField("contentZh", event.target.value)}
            placeholder={t.adminAnnouncementManager.placeholders.contentZh}
            className={textareaClassName()}
          />
          <textarea
            value={form.contentEn}
            onChange={(event) => updateField("contentEn", event.target.value)}
            placeholder={t.adminAnnouncementManager.placeholders.contentEn}
            className={textareaClassName()}
          />
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">{t.adminAnnouncementManager.linkHintTitle}</p>
            <p className="mt-1">{t.adminAnnouncementManager.linkHint}</p>
            <code className="mt-2 block rounded-xl bg-white px-3 py-2 text-xs text-slate-700">
              {t.adminAnnouncementManager.linkExample}
            </code>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t.adminAnnouncementManager.labels.startsAt}
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => updateField("startsAt", event.target.value)}
              className={inputClassName()}
            />
            <p className="text-xs text-slate-500">{t.adminAnnouncementManager.startImmediate}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {t.adminAnnouncementManager.labels.endsAt}
            </label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => updateField("endsAt", event.target.value)}
              className={inputClassName()}
            />
            <p className="text-xs text-slate-500">{t.adminAnnouncementManager.noExpiry}</p>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => updateField("enabled", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-300"
          />
          <span>{t.adminAnnouncementManager.enabledHint}</span>
        </label>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => submit(createOpen ? "create" : "edit")}
            className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving
              ? t.adminAnnouncementManager.saving
              : createOpen
                ? t.adminAnnouncementManager.create
                : t.adminAnnouncementManager.save}
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.customerManager.cancel}
          </button>
        </div>
      </DashboardModal>
    </Panel>
  );
}
