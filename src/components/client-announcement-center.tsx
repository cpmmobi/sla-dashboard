"use client";

import { useMemo, useState } from "react";
import { AnnouncementRichText } from "@/components/announcement-rich-text";
import { DashboardModal } from "@/components/dashboard-ui";
import { getTranslations, Locale } from "@/lib/i18n";
import type { ClientAnnouncement } from "@/lib/mock-backend";

function formatDateTime(value: string | null, locale: Locale) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
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

export function ClientAnnouncementCenter({
  locale,
  authCode,
  announcements,
  initialAnnouncementId,
  triggerVariant = "floating",
}: {
  locale: Locale;
  authCode: string;
  announcements: ClientAnnouncement[];
  initialAnnouncementId: string | null;
  triggerVariant?: "floating" | "sidebar";
}) {
  const t = getTranslations(locale);
  const [isOpen, setIsOpen] = useState(Boolean(initialAnnouncementId));
  const [pendingAutoDismissId, setPendingAutoDismissId] = useState(initialAnnouncementId);
  const [isClosing, setIsClosing] = useState(false);
  const initialIndex = useMemo(() => {
    if (!initialAnnouncementId) {
      return 0;
    }

    const foundIndex = announcements.findIndex((announcement) => announcement.id === initialAnnouncementId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [announcements, initialAnnouncementId]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  if (announcements.length === 0) {
    return null;
  }

  const currentAnnouncement = announcements[selectedIndex] ?? announcements[0];
  const title = locale === "en" ? currentAnnouncement.titleEn : currentAnnouncement.titleZh;
  const content = locale === "en" ? currentAnnouncement.contentEn : currentAnnouncement.contentZh;
  const startLabel = formatDateTime(currentAnnouncement.startsAt, locale);
  const endLabel = formatDateTime(currentAnnouncement.endsAt, locale);

  async function closeModal() {
    setIsOpen(false);

    if (!pendingAutoDismissId || isClosing) {
      return;
    }

    setIsClosing(true);
    const announcementId = pendingAutoDismissId;
    setPendingAutoDismissId(null);

    try {
      await fetch("/api/customer/announcements/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authCode,
          announcementId,
        }),
      });
    } catch {
      // Ignore dismissal failures. The modal is still closable.
    } finally {
      setIsClosing(false);
    }
  }

  function openModal() {
    setIsOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          triggerVariant === "sidebar"
            ? "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            : "fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/95 px-4 py-2.5 text-sm font-medium text-rose-700 shadow-lg shadow-rose-100 backdrop-blur transition hover:bg-rose-50"
        }
      >
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-400" />
        <span>
          {announcements.length > 1
            ? t.announcementCenter.openEntryWithCount(announcements.length)
            : t.announcementCenter.openEntry}
        </span>
      </button>

      <DashboardModal open={isOpen} onClose={closeModal}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                {t.announcementCenter.title}
              </p>
              {selectedIndex === 0 ? (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700">
                  {t.announcementCenter.latestTag}
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-[0.01em] text-slate-950">{title}</h3>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.announcementCenter.close}
          </button>
        </div>

        {(startLabel || endLabel) ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {startLabel && endLabel
              ? t.announcementCenter.validRange(startLabel, endLabel)
              : startLabel
                ? t.announcementCenter.validFrom(startLabel)
                : t.announcementCenter.validUntil(endLabel ?? "")}
          </div>
        ) : null}

        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-700">
          <AnnouncementRichText content={content} />
        </div>

        {announcements.length > 1 ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedIndex((current) => Math.max(current - 1, 0))}
              disabled={selectedIndex === 0}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.announcementCenter.previous}
            </button>
            <span className="text-sm text-slate-500">
              {t.announcementCenter.pageIndicator(selectedIndex + 1, announcements.length)}
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedIndex((current) => Math.min(current + 1, announcements.length - 1))
              }
              disabled={selectedIndex === announcements.length - 1}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.announcementCenter.next}
            </button>
          </div>
        ) : null}
      </DashboardModal>
    </>
  );
}
