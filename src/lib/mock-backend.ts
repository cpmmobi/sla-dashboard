import {
  adminTrafficTrend,
  getAdminActivities,
  getClientHighlightTemplates,
  Metric,
  RegionTrafficRow,
  SeriesPoint,
  DualSeriesPoint,
  ActivityItem,
  TableRow,
} from "@/lib/dashboard-data";
import {
  fetchLiveDomainReport,
  fetchLiveDomainReportResult,
  fetchLiveDomainRegionalTrafficSummaryResult,
  fetchLiveDomainTrafficSummaryResult,
  type LiveDomainReportData,
  type LiveDomainReportFailureReason,
  type LiveDomainReportResult,
} from "@/lib/aliyun-live";
import { ALL_CLIENT_DOMAINS } from "@/lib/client-report-constants";
import { CustomerStatus, Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import {
  CLIENT_REPORT_MIN_DATE,
  defaultReportFilters,
  normalizeBillingCycleReportFilters,
  normalizeClientReportFilters,
  resolveReportWindow,
  type ReportFilters,
} from "@/lib/report-query";
import { Prisma } from "@prisma/client";

export type CustomerRecord = {
  id: string;
  name: string;
  authCode: string;
  domains: string[];
  status: CustomerStatus;
  notes: string;
  accountManagerEmail: string | null;
  renewalDay: number | null;
  monthlyGiftCreditUsd: number | null;
  cumulativeGiftCreditUsd: number | null;
  availableRechargeUsd: number | null;
  cumulativeRechargeUsd: number | null;
  trafficMarkupPercent: number | null;
};

export type AdminRole = "super_admin" | "account_manager";

export type AdminSession = {
  username: string;
  displayName: string;
  role: AdminRole;
};

export type CustomerReportAccessLogRecord = {
  id: string;
  ipAddress: string;
  userAgent: string | null;
  accessedAt: string;
  viewedByAdmin: boolean;
};

export type ManagedCustomerRecord = CustomerRecord & {
  updatedAt: string;
  reportAccessUnreadCount: number;
  reportAccessTotalCount: number;
  lastReportAccessAt: string | null;
};

export type ManagedAdminAccount = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  assignedCustomerCount: number;
  updatedAt: string;
};

export type AnnouncementStatus = "active" | "scheduled" | "expired" | "disabled";

export type ManagedAnnouncement = {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
  status: AnnouncementStatus;
};

export type ClientAnnouncement = {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type ClientAnnouncementView = {
  announcements: ClientAnnouncement[];
  initialAnnouncementId: string | null;
};

export type SettlementStatementStatus = "pending" | "settled" | "partial" | "failed";
export type SettlementStatementType = "daily_charge" | "historical_reconstruction";
export type SettlementLedgerEntryType =
  | "manual_recharge"
  | "manual_writeoff"
  | "manual_cycle_gift"
  | "manual_cumulative_gift"
  | "monthly_gift_grant"
  | "cumulative_gift_grant"
  | "traffic_charge";

export type SettlementAdjustmentType = "recharge" | "writeoff";

export type SettlementBalanceRow = {
  customerId: string;
  customerName: string;
  rechargeBalanceUsd: number;
  monthlyGiftBalanceUsd: number;
  cumulativeGiftBalanceUsd: number;
  totalBalanceUsd: number;
  yesterdayStatus: SettlementStatementStatus;
  lastUpdatedAt: string | null;
};

export type SettlementStatementRow = {
  id: string;
  customerId: string;
  customerName: string;
  statementDate: string;
  statementType: SettlementStatementType;
  trafficCostUsd: number;
  deductedUsd: number;
  remainingAmountUsd: number;
  status: SettlementStatementStatus;
  updatedAt: string;
};

export type SettlementLedgerEntryRow = {
  id: string;
  customerId: string;
  customerName: string;
  entryType: SettlementLedgerEntryType;
  direction: "credit" | "debit";
  amountUsd: number;
  balanceAfterTotalUsd: number;
  note: string;
  createdByUsername: string | null;
  createdAt: string;
};

export type SettlementCenterView = {
  totalCustomers: number;
  totalBalanceUsd: number;
  settledYesterdayCount: number;
  pendingStatementCount: number;
  customers: SettlementBalanceRow[];
  recentStatements: SettlementStatementRow[];
  recentLedgerEntries: SettlementLedgerEntryRow[];
};

export type SettlementCustomerDetailView = {
  customerId: string;
  customerName: string;
  rechargeBalanceUsd: number;
  monthlyGiftBalanceUsd: number;
  cumulativeGiftBalanceUsd: number;
  totalBalanceUsd: number;
  lastUpdatedAt: string | null;
  lastSnapshotAt: string | null;
  lastSettledAt: string | null;
  ledgerEntries: SettlementLedgerEntryRow[];
  statements: SettlementStatementRow[];
};

export type TrafficBoardPeriod =
  | "cycle"
  | "lastCycle"
  | "cycleWaiver"
  | "newCustomerGift"
  | "today"
  | "last24"
  | "last3"
  | "last30"
  | "currentMonth"
  | "lastMonth";

export type TrafficBoardRow = {
  customerId: string;
  customerName: string;
  status: CustomerStatus;
  renewalDay: number | null;
  renewalDayDisplay: string;
  cycleRange: string;
  domainCount: number;
  traffic: string;
  reportHref: string;
  hasLiveData: boolean;
  trafficGb: number;
  trafficCost: string | null;
  trafficCostUsd: number;
  trafficCostCanRetry: boolean;
  cycleWaiverTrafficFee: string | null;
  cycleOverspend: string | null;
  cycleOverspendUsd: number;
  newCustomerGiftCredit: string | null;
  newCustomerGiftCreditUsd: number;
  availableRecharge: string | null;
  availableRechargeUsd: number;
  cumulativeRecharge: string | null;
  cumulativeRechargeUsd: number;
  remainingBalance: string | null;
  remainingBalanceUsd: number;
  pendingTopUp: string | null;
  pendingTopUpUsd: number;
  trafficHint: string | null;
  canRetry: boolean;
  trafficMarkupPercent: number | null;
  projectedMonthTraffic: string | null;
  projectedTrafficCost: string | null;
};

export type TrafficBoardSummary = {
  customerCount: number;
  dueSoonCount: number;
};

export type TrafficBoardShellView = {
  summary: TrafficBoardSummary;
  rows: TrafficBoardRow[];
  generatedAt: string;
  cycleHint: string;
  period: TrafficBoardPeriod;
  trafficLabel: string;
  trafficCostLabel: string;
};

export type TrafficBoardView = {
  metrics: Metric[];
  rows: TrafficBoardRow[];
  generatedAt: string;
  cycleHint: string;
  period: TrafficBoardPeriod;
  trafficLabel: string;
  trafficCostLabel: string;
};

export type TrafficBoardCycleHistoryEntry = {
  cycleRange: string;
  traffic: string;
  trafficGb: number;
  trafficCost: string | null;
  trafficCostUsd: number;
  cycleWaiverTrafficFee: string | null;
  cycleWaiverTrafficFeeUsd: number;
  cycleOverspend: string;
  cycleOverspendUsd: number;
  reportHref: string;
  hasLiveData: boolean;
  trafficHint: string | null;
};

export type TrafficBoardCycleHistoryView = {
  customerId: string;
  customerName: string;
  renewalDayDisplay: string;
  trafficMarkupPercent: number | null;
  generatedAt: string;
  entries: TrafficBoardCycleHistoryEntry[];
};

export type ClientDashboard = {
  customer: CustomerRecord;
  selectedDomain: string;
  availableDomains: string[];
  reportNotice?: string | null;
  metrics: Metric[];
  pvUvTrend: DualSeriesPoint[];
  trafficTrend: SeriesPoint[];
  peakBandwidth: SeriesPoint[];
  highlights: ActivityItem[];
  trafficUsageTable: TableRow[];
  audienceUsageTable: TableRow[];
  regionalTrafficTable: RegionTrafficRow[];
  regionalTrafficTotalCost: string;
  regionalTrafficComplete?: boolean;
};

export type AdminReportRecord = {
  customerId: string;
  customerName: string;
  customer: CustomerRecord;
  domain: string;
  status: CustomerRecord["status"];
  reportNotice?: string | null;
  metrics: Metric[];
  pvUvTrend: DualSeriesPoint[];
  trafficTrend: SeriesPoint[];
  peakBandwidth: SeriesPoint[];
  highlights: ActivityItem[];
  trafficUsageTable: TableRow[];
  audienceUsageTable: TableRow[];
  regionalTrafficTable: RegionTrafficRow[];
  regionalTrafficTotalCost: string;
  regionalTrafficComplete?: boolean;
};

function parseStoredDomains(domainsJson: string, fallbackDomain: string) {
  try {
    const parsed = JSON.parse(domainsJson);

    if (Array.isArray(parsed)) {
      const normalized = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);

      if (normalized.length > 0) {
        return Array.from(new Set(normalized));
      }
    }
  } catch {
    // Fall through to legacy single-domain field.
  }

  return fallbackDomain ? [fallbackDomain] : [];
}

function normalizeDomains(domains: string[]) {
  return Array.from(new Set(domains.map((domain) => domain.trim()).filter(Boolean)));
}

function normalizeAdminRole(role?: string | null): AdminRole {
  return role === "account_manager" ? "account_manager" : "super_admin";
}

function normalizeAccountManagerEmail(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeRenewalDay(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value >= 1 && value <= 31 ? value : null;
}

function normalizeGiftCreditUsd(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 ? Number(value.toFixed(2)) : null;
}

function normalizeRechargeUsd(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 ? Number(value.toFixed(2)) : null;
}

function normalizeTrafficMarkupPercent(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value > 0 ? Number(value.toFixed(2)) : null;
}

function normalizeAnnouncementText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeAnnouncementDateTime(value?: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAnnouncementStatus(
  announcement: {
    enabled: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  now = new Date(),
): AnnouncementStatus {
  if (!announcement.enabled) {
    return "disabled";
  }

  if (announcement.startsAt && announcement.startsAt.getTime() > now.getTime()) {
    return "scheduled";
  }

  if (announcement.endsAt && announcement.endsAt.getTime() < now.getTime()) {
    return "expired";
  }

  return "active";
}

function isAnnouncementActive(
  announcement: {
    enabled: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  now = new Date(),
) {
  return getAnnouncementStatus(announcement, now) === "active";
}

function toManagedAnnouncement(
  announcement: {
    id: string;
    titleZh: string;
    titleEn: string;
    contentZh: string;
    contentEn: string;
    startsAt: Date | null;
    endsAt: Date | null;
    enabled: boolean;
    createdByUsername: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  now = new Date(),
): ManagedAnnouncement {
  return {
    id: announcement.id,
    titleZh: announcement.titleZh,
    titleEn: announcement.titleEn,
    contentZh: announcement.contentZh,
    contentEn: announcement.contentEn,
    startsAt: announcement.startsAt?.toISOString() ?? null,
    endsAt: announcement.endsAt?.toISOString() ?? null,
    enabled: announcement.enabled,
    createdByUsername: announcement.createdByUsername,
    createdAt: announcement.createdAt.toISOString(),
    updatedAt: announcement.updatedAt.toISOString(),
    status: getAnnouncementStatus(announcement, now),
  };
}

function toClientAnnouncement(announcement: {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}): ClientAnnouncement {
  return {
    id: announcement.id,
    titleZh: announcement.titleZh,
    titleEn: announcement.titleEn,
    contentZh: announcement.contentZh,
    contentEn: announcement.contentEn,
    startsAt: announcement.startsAt?.toISOString() ?? null,
    endsAt: announcement.endsAt?.toISOString() ?? null,
    createdAt: announcement.createdAt.toISOString(),
  };
}

function isSuperAdmin(adminSession: AdminSession) {
  return adminSession.role === "super_admin";
}

function assertSuperAdmin(adminSession: AdminSession) {
  if (!isSuperAdmin(adminSession)) {
    throw new Error("ADMIN_ACCESS_DENIED");
  }
}

function toCustomerRecord(customer: {
  id: string;
  name: string;
  authCode: string;
  domain: string;
  domainsJson: string;
  status: string;
  notes: string;
  accountManagerEmail: string | null;
  renewalDay: number | null;
  monthlyGiftCreditUsd?: number | null;
  cumulativeGiftCreditUsd?: number | null;
  availableRechargeUsd?: number | null;
  cumulativeRechargeUsd?: number | null;
  monthlyGiftTrafficGb?: number | null;
  trafficMarkupPercent: number | null;
}): CustomerRecord {
  return {
    id: customer.id,
    name: customer.name,
    authCode: customer.authCode,
    domains: parseStoredDomains(customer.domainsJson, customer.domain),
    status:
      customer.status === "待审查" || customer.status === "停用"
        ? customer.status
        : "正常",
    notes: customer.notes,
    accountManagerEmail: customer.accountManagerEmail,
    renewalDay: normalizeRenewalDay(customer.renewalDay),
    monthlyGiftCreditUsd: normalizeGiftCreditUsd(customer.monthlyGiftCreditUsd),
    cumulativeGiftCreditUsd: normalizeGiftCreditUsd(customer.cumulativeGiftCreditUsd),
    availableRechargeUsd:
      normalizeRechargeUsd(customer.availableRechargeUsd) ?? normalizeRechargeUsd(customer.cumulativeRechargeUsd),
    cumulativeRechargeUsd: normalizeRechargeUsd(customer.cumulativeRechargeUsd),
    trafficMarkupPercent: normalizeTrafficMarkupPercent(customer.trafficMarkupPercent),
  };
}

const customerCoreSelect = {
  id: true,
  name: true,
  authCode: true,
  domain: true,
  domainsJson: true,
  status: true,
  timezone: true,
  contact: true,
  notes: true,
  accountManagerEmail: true,
  renewalDay: true,
  monthlyGiftCreditUsd: true,
  cumulativeGiftCreditUsd: true,
  availableRechargeUsd: true,
  cumulativeRechargeUsd: true,
  trafficMarkupPercent: true,
} as const;

function buildUnavailableMetrics(locale: Locale): Metric[] {
  if (locale === "en") {
    return [
      { label: "Total Traffic", value: "--", delta: "Alibaba Cloud only", tone: "brand" },
      { label: "Average Bandwidth", value: "--", delta: "Alibaba Cloud only", tone: "success" },
      { label: "Peak Bandwidth", value: "--", delta: "Alibaba Cloud only", tone: "warning" },
      { label: "Peak Bandwidth Time", value: "--", delta: "Alibaba Cloud only", tone: "brand" },
      { label: "UV Peak", value: "--", delta: "Alibaba Cloud only", tone: "warning" },
      { label: "Average UV", value: "--", delta: "Alibaba Cloud only", tone: "success" },
      { label: "UV Peak Time", value: "--", delta: "Alibaba Cloud only", tone: "brand" },
      { label: "Average PV", value: "--", delta: "Alibaba Cloud only", tone: "brand" },
    ];
  }

  return [
    { label: "累计流量", value: "--", delta: "仅展示阿里云真实数据", tone: "brand" },
    { label: "平均带宽", value: "--", delta: "仅展示阿里云真实数据", tone: "success" },
    { label: "带宽峰值", value: "--", delta: "仅展示阿里云真实数据", tone: "warning" },
    { label: "峰值时间", value: "--", delta: "仅展示阿里云真实数据", tone: "brand" },
    { label: "UV 峰值", value: "--", delta: "仅展示阿里云真实数据", tone: "warning" },
    { label: "平均 UV", value: "--", delta: "仅展示阿里云真实数据", tone: "success" },
    { label: "UV 峰值时间", value: "--", delta: "仅展示阿里云真实数据", tone: "brand" },
    { label: "平均 PV", value: "--", delta: "仅展示阿里云真实数据", tone: "brand" },
  ];
}

function getAllDomainsIncompleteNotice(
  locale: Locale,
  matchedDomainCount: number,
  totalDomainCount: number,
) {
  if (locale === "en") {
    return `The All Domains query is incomplete. Only ${matchedDomainCount}/${totalDomainCount} domains returned Alibaba Cloud data. Please try again later or query domains separately.`;
  }

  return `全域名查询未完成，本次仅有 ${matchedDomainCount}/${totalDomainCount} 个域名成功获取到阿里云数据。为保证准确性，请稍后重试或改为逐个域名查询。`;
}

function buildHighlights(customer: CustomerRecord, locale: Locale, domain: string): ActivityItem[] {
  const templates = getClientHighlightTemplates(locale);

  return [
    { ...templates[0], meta: domain },
    { ...templates[1] },
    { ...templates[2] },
    {
      ...templates[3],
      meta:
        locale === "en"
          ? `${customer.notes}. Data delay is about 5-15 minutes`
          : `${customer.notes} 数据延迟约 5-15 分钟`,
    },
  ];
}

function buildUnavailableReport(locale: Locale) {
  return {
    metrics: buildUnavailableMetrics(locale),
    pvUvTrend: [] as DualSeriesPoint[],
    trafficTrend: [] as SeriesPoint[],
    peakBandwidth: [] as SeriesPoint[],
    trafficUsageTable: [] as TableRow[],
    audienceUsageTable: [] as TableRow[],
    regionalTrafficTable: [] as RegionTrafficRow[],
    regionalTrafficTotalCost: "--",
    regionalTrafficComplete: false,
  };
}

function parseLocalizedNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringifyTrafficBoardLog(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function parseTrafficToGb(value: string) {
  const numeric = parseLocalizedNumber(value.replace(/[^0-9.\-]/g, ""));

  if (value.includes("TB")) {
    return numeric * 1024;
  }

  return numeric;
}

function parseBandwidthToMbps(value: string) {
  const numeric = parseLocalizedNumber(value.replace(/[^0-9.\-]/g, ""));

  if (value.includes("Gbps")) {
    return numeric * 1000;
  }

  return numeric;
}

function parseUsd(value: string) {
  return parseLocalizedNumber(value.replace(/[^0-9.\-]/g, ""));
}

function formatTrafficFromGb(valueGb: number, locale: Locale) {
  if (valueGb >= 1024) {
    return `${(valueGb / 1024).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })} TB`;
  }

  return `${valueGb.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} GB`;
}

function formatBandwidthFromMbps(valueMbps: number, locale: Locale) {
  if (valueMbps >= 1000) {
    return `${(valueMbps / 1000).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })} Gbps`;
  }

  return `${valueMbps.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} Mbps`;
}

function getDatePartsAtOffset(date: Date, offsetMinutes: number) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatLocalDateTime(year: number, month: number, day: number, hour = 0, minute = 0) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatBillingRangeDate(month: number, day: number, locale: Locale) {
  return locale === "en"
    ? `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
    : `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getPreviousYearMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function getNextYearMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function formatRenewalDayDisplay(renewalDay: number | null, locale: Locale) {
  const normalizedRenewalDay = renewalDay ?? 1;

  if (renewalDay === null) {
    return locale === "en"
      ? `Day ${normalizedRenewalDay} (default)`
      : `每月 ${normalizedRenewalDay} 号（默认）`;
  }

  return locale === "en" ? `Day ${normalizedRenewalDay}` : `每月 ${normalizedRenewalDay} 号`;
}

function resolveShiftedBillingCycleBoundary(
  renewalDay: number | null,
  referenceYear: number,
  referenceMonth: number,
  offsetMinutes: number,
) {
  const normalizedRenewalDay = renewalDay ?? 1;
  const renewalDayInMonth = Math.min(normalizedRenewalDay, getDaysInMonth(referenceYear, referenceMonth));
  const renewalUtc =
    Date.UTC(referenceYear, referenceMonth - 1, renewalDayInMonth, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
  const boundaryUtc = renewalUtc - 24 * 60 * 60 * 1000;
  const boundaryLocal = getDatePartsAtOffset(new Date(boundaryUtc), offsetMinutes);

  return {
    referenceYear,
    referenceMonth,
    normalizedRenewalDay,
    boundaryUtc,
    boundaryYear: boundaryLocal.year,
    boundaryMonth: boundaryLocal.month,
    boundaryDay: boundaryLocal.day,
  };
}

function getCurrentBillingCycleMeta(
  renewalDay: number | null,
  locale: Locale,
  now: Date,
  offsetMinutes = 8 * 60,
) {
  const current = getDatePartsAtOffset(now, offsetMinutes);
  const currentMonthBoundary = resolveShiftedBillingCycleBoundary(
    renewalDay,
    current.year,
    current.month,
    offsetMinutes,
  );
  const cycleBoundary =
    now.getTime() >= currentMonthBoundary.boundaryUtc
      ? currentMonthBoundary
      : (() => {
          const previousMonth = getPreviousYearMonth(current.year, current.month);
          return resolveShiftedBillingCycleBoundary(
            renewalDay,
            previousMonth.year,
            previousMonth.month,
            offsetMinutes,
          );
        })();
  const nextCycleReference = getNextYearMonth(cycleBoundary.referenceYear, cycleBoundary.referenceMonth);
  const nextCycleBoundary = resolveShiftedBillingCycleBoundary(
    renewalDay,
    nextCycleReference.year,
    nextCycleReference.month,
    offsetMinutes,
  );
  const currentMonthRenewalDay = Math.min(renewalDay ?? 1, getDaysInMonth(current.year, current.month));
  const currentMonthRenewalUtc =
    Date.UTC(current.year, current.month - 1, currentMonthRenewalDay, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
  const nextRenewalReference =
    now.getTime() < currentMonthRenewalUtc
      ? { year: current.year, month: current.month }
      : getNextYearMonth(current.year, current.month);
  const nextRenewalDay = Math.min(renewalDay ?? 1, getDaysInMonth(nextRenewalReference.year, nextRenewalReference.month));
  const nextRenewalUtc =
    Date.UTC(nextRenewalReference.year, nextRenewalReference.month - 1, nextRenewalDay, 0, 0, 0, 0) -
    offsetMinutes * 60 * 1000;
  const daysUntilRenewal = Math.max(
    0,
    Math.ceil((nextRenewalUtc - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const cycleElapsedDays = Math.max(
    1 / (24 * 60),
    (now.getTime() - cycleBoundary.boundaryUtc) / (24 * 60 * 60 * 1000),
  );
  const cycleTotalDays = Math.max(
    cycleElapsedDays,
    (nextCycleBoundary.boundaryUtc - cycleBoundary.boundaryUtc) / (24 * 60 * 60 * 1000),
  );

  return {
    filters: {
      queryType: "traffic" as const,
      timeRange: "custom" as const,
      area: "all" as const,
      from: formatLocalDateTime(
        cycleBoundary.boundaryYear,
        cycleBoundary.boundaryMonth,
        cycleBoundary.boundaryDay,
        0,
        0,
      ),
      to: formatLocalDateTime(current.year, current.month, current.day, current.hour, current.minute),
      timeZone: "Asia/Shanghai",
      timeZoneOffsetMinutes: offsetMinutes,
      locations: [],
    },
    cycleRange: `${formatBillingRangeDate(cycleBoundary.boundaryMonth, cycleBoundary.boundaryDay, locale)} - ${formatBillingRangeDate(
      current.month,
      current.day,
      locale,
    )}`,
    renewalDayDisplay: formatRenewalDayDisplay(renewalDay, locale),
    daysUntilRenewal,
    windowElapsedDays: cycleElapsedDays,
    windowTotalDays: cycleTotalDays,
    cycleStartYear: cycleBoundary.boundaryYear,
    cycleStartMonth: cycleBoundary.boundaryMonth,
    cycleStartDay: cycleBoundary.boundaryDay,
    cycleStartUtc: cycleBoundary.boundaryUtc,
    cycleEndUtc: nextCycleBoundary.boundaryUtc,
    cycleBoundaryReferenceYear: cycleBoundary.referenceYear,
    cycleBoundaryReferenceMonth: cycleBoundary.referenceMonth,
    normalizedRenewalDay: cycleBoundary.normalizedRenewalDay,
    offsetMinutes,
  };
}

function getPreviousBillingCycleMeta(
  renewalDay: number | null,
  locale: Locale,
  now: Date,
  offsetMinutes = 8 * 60,
) {
  const currentCycle = getCurrentBillingCycleMeta(renewalDay, locale, now, offsetMinutes);
  const { year: previousCycleReferenceYear, month: previousCycleReferenceMonth } = getPreviousYearMonth(
    currentCycle.cycleBoundaryReferenceYear,
    currentCycle.cycleBoundaryReferenceMonth,
  );
  const previousCycleBoundary = resolveShiftedBillingCycleBoundary(
    renewalDay,
    previousCycleReferenceYear,
    previousCycleReferenceMonth,
    currentCycle.offsetMinutes,
  );
  const previousCycleEndParts = getDatePartsAtOffset(
    new Date(currentCycle.cycleStartUtc - 60 * 1000),
    currentCycle.offsetMinutes,
  );
  const previousCycleTotalDays = Math.max(
    1,
    Math.ceil((currentCycle.cycleStartUtc - previousCycleBoundary.boundaryUtc) / (24 * 60 * 60 * 1000)),
  );

  return {
    filters: {
      queryType: "traffic" as const,
      timeRange: "custom" as const,
      area: "all" as const,
      from: formatLocalDateTime(
        previousCycleBoundary.boundaryYear,
        previousCycleBoundary.boundaryMonth,
        previousCycleBoundary.boundaryDay,
        0,
        0,
      ),
      to: formatLocalDateTime(
        previousCycleEndParts.year,
        previousCycleEndParts.month,
        previousCycleEndParts.day,
        previousCycleEndParts.hour,
        previousCycleEndParts.minute,
      ),
      timeZone: "Asia/Shanghai",
      timeZoneOffsetMinutes: currentCycle.offsetMinutes,
      locations: [],
    },
    cycleRange: `${formatBillingRangeDate(previousCycleBoundary.boundaryMonth, previousCycleBoundary.boundaryDay, locale)} - ${formatBillingRangeDate(previousCycleEndParts.month, previousCycleEndParts.day, locale)}`,
    renewalDayDisplay: locale === "en" ? "Previous Billing Cycle" : "上一账期",
    daysUntilRenewal: 0,
    windowElapsedDays: previousCycleTotalDays,
    windowTotalDays: previousCycleTotalDays,
    cycleStartYear: previousCycleBoundary.boundaryYear,
    cycleStartMonth: previousCycleBoundary.boundaryMonth,
    cycleStartDay: previousCycleBoundary.boundaryDay,
    cycleStartUtc: previousCycleBoundary.boundaryUtc,
    cycleEndUtc: currentCycle.cycleStartUtc,
    cycleBoundaryReferenceYear: previousCycleBoundary.referenceYear,
    cycleBoundaryReferenceMonth: previousCycleBoundary.referenceMonth,
    normalizedRenewalDay: previousCycleBoundary.normalizedRenewalDay,
    offsetMinutes: currentCycle.offsetMinutes,
  };
}

function shouldShowGiftTrafficProjection(period: TrafficBoardPeriod) {
  return period === "cycle" || period === "lastCycle";
}

function isCycleWaiverTrafficPeriod(period: TrafficBoardPeriod) {
  return period === "cycleWaiver";
}

function isNewCustomerGiftTrafficPeriod(period: TrafficBoardPeriod) {
  return period === "newCustomerGift";
}

function shouldIncludeCustomerInTrafficBoardPeriod(customer: CustomerRecord, period: TrafficBoardPeriod) {
  if (isNewCustomerGiftTrafficPeriod(period)) {
    return (customer.cumulativeGiftCreditUsd ?? 0) > 0;
  }

  if (isCycleWaiverTrafficPeriod(period)) {
    return (customer.monthlyGiftCreditUsd ?? 0) > 0;
  }

  return true;
}

function buildTrafficBoardFilters(period: TrafficBoardPeriod, renewalDay: number | null, locale: Locale, now: Date) {
  if (period === "cycle") {
    return getCurrentBillingCycleMeta(renewalDay, locale, now);
  }

  if (period === "cycleWaiver") {
    return getCurrentBillingCycleMeta(renewalDay, locale, now);
  }

  if (period === "lastCycle") {
    return getPreviousBillingCycleMeta(renewalDay, locale, now);
  }

  const nowParts = getDatePartsAtOffset(now, 8 * 60);
  const baseFilters: ReportFilters = {
    queryType: "traffic",
    timeRange: period === "today" ? "today" : period === "last30" ? "last30" : "custom",
    area: "all",
    locations: [],
    timeZone: "Asia/Shanghai",
    timeZoneOffsetMinutes: 8 * 60,
  };

  if (period === "newCustomerGift") {
    const [startYear, startMonth, startDay] = CLIENT_REPORT_MIN_DATE.split("-").map(Number);

    return {
      filters: {
        ...baseFilters,
        allowLongRange: true,
        from: formatLocalDateTime(startYear, startMonth, startDay, 0, 0),
        to: formatLocalDateTime(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute),
      },
      cycleRange: `${formatBillingRangeDate(startMonth, startDay, locale)} - ${formatBillingRangeDate(
        nowParts.month,
        nowParts.day,
        locale,
      )}`,
      renewalDayDisplay: locale === "en" ? "New Customer Gift" : "新客赠送",
      daysUntilRenewal: 0,
      windowElapsedDays: null,
      windowTotalDays: null,
    };
  }

  if (period === "last24") {
    const startParts = getDatePartsAtOffset(new Date(now.getTime() - 24 * 60 * 60 * 1000), 8 * 60);

    return {
      filters: {
        ...baseFilters,
        from: formatLocalDateTime(startParts.year, startParts.month, startParts.day, startParts.hour, startParts.minute),
        to: formatLocalDateTime(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute),
      },
      cycleRange: locale === "en" ? "Last 24 Hours" : "近 24 小时",
      renewalDayDisplay: locale === "en" ? "Rolling Window" : "滚动窗口",
      daysUntilRenewal: 0,
      windowElapsedDays: null,
      windowTotalDays: null,
    };
  }

  if (period === "last3") {
    const start = new Date(
      Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 0, 0, 0, 0) - 8 * 60 * 60 * 1000,
    );
    const startParts = getDatePartsAtOffset(
      new Date(start.getTime() - 2 * 24 * 60 * 60 * 1000),
      8 * 60,
    );

    return {
      filters: {
        ...baseFilters,
        from: formatLocalDateTime(startParts.year, startParts.month, startParts.day, 0, 0),
        to: formatLocalDateTime(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute),
      },
      cycleRange: `${formatBillingRangeDate(startParts.month, startParts.day, locale)} - ${formatBillingRangeDate(
        nowParts.month,
        nowParts.day,
        locale,
      )}`,
      renewalDayDisplay: locale === "en" ? "Custom range" : "自定义区间",
      daysUntilRenewal: 0,
      windowElapsedDays: null,
      windowTotalDays: null,
    };
  }

  if (period === "currentMonth") {
    return {
      filters: {
        ...baseFilters,
        from: formatLocalDateTime(nowParts.year, nowParts.month, 1, 0, 0),
        to: formatLocalDateTime(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute),
      },
      cycleRange: `${formatBillingRangeDate(nowParts.month, 1, locale)} - ${formatBillingRangeDate(
        nowParts.month,
        nowParts.day,
        locale,
      )}`,
      renewalDayDisplay: locale === "en" ? "This Month" : "本月",
      daysUntilRenewal: 0,
      windowElapsedDays: nowParts.day,
      windowTotalDays: getDaysInMonth(nowParts.year, nowParts.month),
    };
  }

  if (period === "lastMonth") {
    const lastMonthYear = nowParts.month === 1 ? nowParts.year - 1 : nowParts.year;
    const lastMonth = nowParts.month === 1 ? 12 : nowParts.month - 1;
    const lastMonthDays = getDaysInMonth(lastMonthYear, lastMonth);

    return {
      filters: {
        ...baseFilters,
        from: formatLocalDateTime(lastMonthYear, lastMonth, 1, 0, 0),
        to: formatLocalDateTime(lastMonthYear, lastMonth, lastMonthDays, 23, 59),
      },
      cycleRange: `${formatBillingRangeDate(lastMonth, 1, locale)} - ${formatBillingRangeDate(
        lastMonth,
        lastMonthDays,
        locale,
      )}`,
      renewalDayDisplay: locale === "en" ? "Last Month" : "上月",
      daysUntilRenewal: 0,
      windowElapsedDays: lastMonthDays,
      windowTotalDays: lastMonthDays,
    };
  }

  const label =
    period === "today"
      ? formatBillingRangeDate(nowParts.month, nowParts.day, locale)
      : `${formatBillingRangeDate(
          new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).getUTCMonth() + 1,
          getDatePartsAtOffset(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000), 8 * 60).day,
          locale,
        )} - ${formatBillingRangeDate(nowParts.month, nowParts.day, locale)}`;

  return {
    filters: baseFilters,
    cycleRange: label,
    renewalDayDisplay: period === "today" ? (locale === "en" ? "Today" : "今日") : locale === "en" ? "Last 30 Days" : "近 30 天",
    daysUntilRenewal: 0,
    windowElapsedDays: null,
    windowTotalDays: null,
  };
}

function buildRollingHoursTrafficFilters(hours: number, now: Date, offsetMinutes = 8 * 60) {
  const safeHours = Math.max(1, hours);
  const nowParts = getDatePartsAtOffset(now, offsetMinutes);
  const start = new Date(now.getTime() - safeHours * 60 * 60 * 1000);
  const startParts = getDatePartsAtOffset(start, offsetMinutes);

  return {
    filters: {
      queryType: "traffic" as const,
      timeRange: "custom" as const,
      area: "all" as const,
      from: formatLocalDateTime(startParts.year, startParts.month, startParts.day, startParts.hour, startParts.minute),
      to: formatLocalDateTime(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute),
      timeZone: "Asia/Shanghai",
      timeZoneOffsetMinutes: offsetMinutes,
      locations: [],
    },
    elapsedHours: Math.max(1 / 60, (now.getTime() - start.getTime()) / (60 * 60 * 1000)),
  };
}

function buildTrafficBoardReportHref(
  customer: CustomerRecord,
  period: TrafficBoardPeriod,
  filters: ReportFilters,
) {
  const params = new URLSearchParams({
    customerId: customer.id,
    queryType: "traffic",
    domain: customer.domains.length > 1 ? ALL_CLIENT_DOMAINS : customer.domains[0] ?? "",
  });

  if (period === "today") {
    params.set("range", "today");
  } else if (period === "last30") {
    params.set("range", "last30");
  } else {
    params.set("range", "custom");
    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }
  }

  if (filters.timeZone) {
    params.set("tz", filters.timeZone);
  }

  if (typeof filters.timeZoneOffsetMinutes === "number") {
    params.set("tzOffset", String(filters.timeZoneOffsetMinutes));
  }

  if (filters.allowLongRange) {
    params.set("allowLongRange", "1");
  }

  return `/admin/reports?${params.toString()}`;
}

function getTrafficMetricLabel(locale: Locale, period: TrafficBoardPeriod) {
  if (locale === "en") {
    if (period === "cycleWaiver") {
      return "Current Cycle Traffic";
    }

    if (period === "newCustomerGift") {
      return "Cumulative Consumption Traffic";
    }

    if (period === "today") {
      return "Today's Traffic";
    }

    if (period === "last24") {
      return "Last 24 Hours Traffic";
    }

    if (period === "lastCycle") {
      return "Previous Cycle Traffic";
    }

    if (period === "last3") {
      return "Last 3 Days Traffic";
    }

    if (period === "last30") {
      return "Last 30 Days Traffic";
    }

    if (period === "currentMonth") {
      return "This Month Traffic";
    }

    if (period === "lastMonth") {
      return "Last Month Traffic";
    }

    return "Cycle Traffic";
  }

  if (period === "today") {
    return "今日流量";
  }

  if (period === "cycleWaiver") {
    return "当前账期流量";
  }

  if (period === "newCustomerGift") {
    return "累计消耗流量";
  }

  if (period === "last24") {
    return "近 24 小时流量";
  }

  if (period === "lastCycle") {
    return "上一账期流量";
  }

  if (period === "last3") {
    return "近 3 天流量";
  }

  if (period === "last30") {
    return "近 30 天流量";
  }

  if (period === "currentMonth") {
    return "本月流量";
  }

  if (period === "lastMonth") {
    return "上月流量";
  }

  return "账期流量";
}

function getTrafficCostMetricLabel(locale: Locale, period: TrafficBoardPeriod) {
  if (locale === "en") {
    if (period === "cycleWaiver") {
      return "Current Cycle Cost";
    }

    if (period === "newCustomerGift") {
      return "Gift Consumption Cost";
    }

    if (period === "today") {
      return "Today Cost";
    }

    if (period === "last24") {
      return "Last 24 Hours Cost";
    }

    if (period === "lastCycle") {
      return "Previous Cycle Cost";
    }

    if (period === "last3") {
      return "Last 3 Days Cost";
    }

    if (period === "last30") {
      return "Last 30 Days Cost";
    }

    if (period === "currentMonth") {
      return "This Month Cost";
    }

    if (period === "lastMonth") {
      return "Last Month Cost";
    }

    return "Traffic Cost";
  }

  if (period === "today") {
    return "今日流量费用";
  }

  if (period === "cycleWaiver") {
    return "当前账期金额";
  }

  if (period === "newCustomerGift") {
    return "赠送消耗费用";
  }

  if (period === "last24") {
    return "近 24 小时流量费用";
  }

  if (period === "lastCycle") {
    return "上一账期流量费用";
  }

  if (period === "last3") {
    return "近 3 天流量费用";
  }

  if (period === "last30") {
    return "近 30 天流量费用";
  }

  if (period === "currentMonth") {
    return "本月流量费用";
  }

  if (period === "lastMonth") {
    return "上月流量费用";
  }

  return "流量费用";
}

function getTrafficBoardHint(
  locale: Locale,
  reason:
    | "inactive"
    | "no_domains"
    | LiveDomainReportFailureReason
    | "partial_domains",
  matchedDomainCount?: number,
  totalDomainCount?: number,
) {
  if (locale === "en") {
    if (reason === "inactive") {
      return "Customer is not active";
    }

    if (reason === "no_domains") {
      return "No playback domains configured";
    }

    if (reason === "domain_not_found") {
      return "Domain not found in the current Alibaba Cloud account";
    }

    if (reason === "empty") {
      return "No traffic data in the selected period";
    }

    if (reason === "partial_domains") {
      return `Only ${matchedDomainCount ?? 0}/${totalDomainCount ?? 0} domains returned Alibaba Cloud data`;
    }

    return "Alibaba Cloud query failed";
  }

  if (reason === "inactive") {
    return "客户当前不是正常状态";
  }

  if (reason === "no_domains") {
    return "未配置播放域名";
  }

  if (reason === "domain_not_found") {
    return "域名未在当前阿里云账号中找到";
  }

  if (reason === "empty") {
    return "所选时间段暂无流量数据";
  }

  if (reason === "partial_domains") {
    return `仅 ${matchedDomainCount ?? 0}/${totalDomainCount ?? 0} 个域名查到阿里云数据`;
  }

  return "阿里云查询失败，请稍后重试";
}

function getTrafficBoardCycleHint(locale: Locale, period: TrafficBoardPeriod) {
  if (locale === "en") {
    if (period === "cycleWaiver") {
      return `Shows customers with cycle waiver only. The table displays current-cycle actual data, and clicking a customer opens cycle history since ${CLIENT_REPORT_MIN_DATE}.`;
    }

    if (period === "newCustomerGift") {
      return `Shows only customers with new-customer gift credit, from ${CLIENT_REPORT_MIN_DATE} until now in Asia/Shanghai.`;
    }

    if (period === "cycle") {
      return "Billing-cycle traffic is accumulated from the day before each customer's renewal day to now, using Asia/Shanghai.";
    }

    if (period === "today") {
      return "Shows today's traffic for each customer, using Asia/Shanghai.";
    }

    if (period === "last24") {
      return "Shows each customer's last 24 hours of traffic, using Asia/Shanghai.";
    }

    if (period === "lastCycle") {
      return "Shows each customer's previous billing cycle traffic, using Asia/Shanghai.";
    }

    if (period === "last3") {
      return "Shows the recent 3 days of traffic for each customer, using Asia/Shanghai.";
    }

    if (period === "currentMonth") {
      return "Shows each customer's current month traffic, using Asia/Shanghai.";
    }

    if (period === "lastMonth") {
      return "Shows each customer's previous month traffic, using Asia/Shanghai.";
    }

    return "Shows the recent 30 days of traffic for each customer, using Asia/Shanghai.";
  }

  if (period === "cycle") {
    return "账期流量会从每个客户续费日前一天开始累计到当前，按北京时间统计。";
  }

  if (period === "cycleWaiver") {
    return `当前仅展示设置了账期获免的客户，主表显示当前账期实际数据，点击客户可查看 ${CLIENT_REPORT_MIN_DATE} 起的历史账期明细。`;
  }

  if (period === "newCustomerGift") {
    return `当前仅展示设置了新客赠送的客户，统计范围为 ${CLIENT_REPORT_MIN_DATE} 00:00 到当前，按北京时间统计。`;
  }

  if (period === "today") {
    return "当前展示的是每个客户今日流量，按北京时间统计。";
  }

  if (period === "last24") {
    return "当前展示的是每个客户近 24 小时流量，按北京时间滚动统计。";
  }

  if (period === "lastCycle") {
    return "当前展示的是每个客户上一账期流量，按北京时间统计。";
  }

  if (period === "last3") {
    return "当前展示的是每个客户近 3 天流量，按北京时间统计。";
  }

  if (period === "currentMonth") {
    return "当前展示的是每个客户本月流量，按北京时间统计。";
  }

  if (period === "lastMonth") {
    return "当前展示的是每个客户上月流量，按北京时间统计。";
  }

  return "当前展示的是每个客户近 30 天流量，按北京时间统计。";
}

function buildTrafficBoardMetrics(
  locale: Locale,
  rows: TrafficBoardRow[],
  dueSoonCount: number,
  period: TrafficBoardPeriod,
): Metric[] {
  const customerCount = rows.length;
  const totalTrafficGb = rows.reduce((sum, row) => sum + row.trafficGb, 0);
  const liveCustomerCount = rows.filter((row) => row.hasLiveData).length;
  const totalTrafficCostUsd = rows.reduce((sum, row) => sum + row.trafficCostUsd, 0);
  const totalAvailableRechargeUsd = rows.reduce((sum, row) => sum + row.availableRechargeUsd, 0);
  const totalRechargeUsd = rows.reduce((sum, row) => sum + row.cumulativeRechargeUsd, 0);
  const totalRemainingBalanceUsd = rows.reduce((sum, row) => sum + row.remainingBalanceUsd, 0);
  const totalPendingTopUpUsd = rows.reduce((sum, row) => sum + row.pendingTopUpUsd, 0);

  if (locale === "en") {
    if (period === "cycleWaiver") {
      return [
        {
          label: "Waiver Customers",
          value: String(customerCount),
          delta: "Customers with cycle waiver credit",
          tone: "brand",
        },
        {
          label: getTrafficMetricLabel(locale, period),
          value: formatTrafficFromGb(totalTrafficGb, locale),
          delta: "Current cycle actual traffic",
          tone: "success",
        },
        {
          label: getTrafficCostMetricLabel(locale, period),
          value: formatUsd(totalTrafficCostUsd, locale),
          delta: "Current cycle actual cost",
          tone: "warning",
        },
        {
          label: "Available Recharge",
          value: formatUsd(totalAvailableRechargeUsd, locale),
          delta: "Manual available recharge balance",
          tone: "brand",
        },
        {
          label: "Top-up Needed",
          value: formatUsd(totalPendingTopUpUsd, locale),
          delta: "Current cycle amount still unpaid",
          tone: totalPendingTopUpUsd > 0 ? "warning" : "success",
        },
      ];
    }

    if (period === "newCustomerGift") {
      return [
        {
          label: "Gift Customers",
          value: String(customerCount),
          delta: "Customers with new-customer gift credit",
          tone: "brand",
        },
        {
          label: getTrafficMetricLabel(locale, period),
          value: formatTrafficFromGb(totalTrafficGb, locale),
          delta: `From ${CLIENT_REPORT_MIN_DATE} until now`,
          tone: "success",
        },
        {
          label: getTrafficCostMetricLabel(locale, period),
          value: formatUsd(totalTrafficCostUsd, locale),
          delta: "Alibaba Cloud cumulative cost",
          tone: "warning",
        },
        {
          label: "Cumulative Recharge",
          value: formatUsd(totalRechargeUsd, locale),
          delta: "Manual cumulative recharge amount",
          tone: "brand",
        },
        {
          label: "Remaining Available",
          value: formatUsd(totalRemainingBalanceUsd, locale),
          delta: "Gift + recharge - cost",
          tone: "success",
        },
      ];
    }

    return [
      {
        label: "Managed Customers",
        value: String(customerCount),
        delta: "Current visible scope",
        tone: "brand",
      },
      {
        label: getTrafficMetricLabel(locale, period),
        value: formatTrafficFromGb(totalTrafficGb, locale),
        delta:
          period === "cycle"
            ? "From each renewal day to now"
            : period === "today"
              ? "Current day in Asia/Shanghai"
              : period === "last24"
                ? "Last 24 hours in Asia/Shanghai"
              : period === "lastCycle"
                ? "Previous billing cycle in Asia/Shanghai"
              : period === "last3"
                ? "Recent 3 days in Asia/Shanghai"
                : period === "currentMonth"
                  ? "Current month in Asia/Shanghai"
                  : period === "lastMonth"
                    ? "Previous month in Asia/Shanghai"
                : "Recent 30 days in Asia/Shanghai",
        tone: "success",
      },
      {
        label: "Customers With Data",
        value: String(liveCustomerCount),
        delta: "Alibaba Cloud traffic available",
        tone: "warning",
      },
      {
        label: "Renewing Soon",
        value: String(dueSoonCount),
        delta: "Within the next 3 days",
        tone: "brand",
      },
    ];
  }

  if (period === "cycleWaiver") {
    return [
      {
        label: "获免客户",
        value: String(customerCount),
        delta: "仅展示设置了账期获免的客户",
        tone: "brand",
      },
      {
        label: getTrafficMetricLabel(locale, period),
        value: formatTrafficFromGb(totalTrafficGb, locale),
        delta: "当前账期实际流量",
        tone: "success",
      },
      {
        label: getTrafficCostMetricLabel(locale, period),
        value: formatUsd(totalTrafficCostUsd, locale),
        delta: "当前账期实际金额",
        tone: "warning",
      },
      {
        label: "可用充值",
        value: formatUsd(totalAvailableRechargeUsd, locale),
        delta: "客户管理里手工维护的可用余额",
        tone: "brand",
      },
      {
        label: "待补金额",
        value: formatUsd(totalPendingTopUpUsd, locale),
        delta: "当前账期仍需补的金额",
        tone: totalPendingTopUpUsd > 0 ? "warning" : "success",
      },
    ];
  }

  if (period === "newCustomerGift") {
    return [
      {
        label: "赠送客户",
        value: String(customerCount),
        delta: "仅展示设置了新客赠送的客户",
        tone: "brand",
      },
      {
        label: getTrafficMetricLabel(locale, period),
        value: formatTrafficFromGb(totalTrafficGb, locale),
        delta: `从 ${CLIENT_REPORT_MIN_DATE} 到当前`,
        tone: "success",
      },
      {
        label: getTrafficCostMetricLabel(locale, period),
        value: formatUsd(totalTrafficCostUsd, locale),
        delta: "阿里云累计消耗费用",
        tone: "warning",
      },
      {
        label: "累计充值",
        value: formatUsd(totalRechargeUsd, locale),
        delta: "客户管理里手工记录的累计充值金额",
        tone: "brand",
      },
      {
        label: "剩余可用",
        value: formatUsd(totalRemainingBalanceUsd, locale),
        delta: "充值 + 赠送 - 消耗",
        tone: "success",
      },
    ];
  }

  return [
    {
      label: "归属客户",
      value: String(customerCount),
      delta: "当前可见范围",
      tone: "brand",
    },
    {
      label: getTrafficMetricLabel(locale, period),
      value: formatTrafficFromGb(totalTrafficGb, locale),
      delta:
        period === "cycle"
          ? "按各客户续费日累计到当前"
          : period === "today"
            ? "按北京时间统计今日流量"
            : period === "last24"
              ? "按北京时间统计近 24 小时流量"
            : period === "lastCycle"
              ? "按北京时间统计上一账期流量"
            : period === "last3"
              ? "按北京时间统计近 3 天流量"
              : period === "currentMonth"
                ? "按北京时间统计本月流量"
                : period === "lastMonth"
                  ? "按北京时间统计上月流量"
              : "按北京时间统计近 30 天流量",
      tone: "success",
    },
    {
      label: "有数据客户",
      value: String(liveCustomerCount),
      delta: "可查到阿里云流量数据",
      tone: "warning",
    },
    {
      label: "近 3 天续费",
      value: String(dueSoonCount),
      delta: "便于及时提醒充值",
      tone: "brand",
    },
  ];
}

function formatUsd(value: number, locale: Locale) {
  return `${value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}

function getTrafficMarkupFactor(trafficMarkupPercent?: number | null) {
  return 1 + (normalizeTrafficMarkupPercent(trafficMarkupPercent) ?? 0) / 100;
}

function applyTrafficMarkupToGb(valueGb: number, trafficMarkupPercent?: number | null) {
  return Number((valueGb * getTrafficMarkupFactor(trafficMarkupPercent)).toFixed(2));
}

function applyTrafficMarkupToUsd(valueUsd: number, trafficMarkupPercent?: number | null) {
  return Number((valueUsd * getTrafficMarkupFactor(trafficMarkupPercent)).toFixed(2));
}

function applyTrafficMarkupToLiveReportData(
  report: LiveDomainReportData,
  trafficMarkupPercent: number | null | undefined,
  locale: Locale,
): LiveDomainReportData {
  const normalizedTrafficMarkupPercent = normalizeTrafficMarkupPercent(trafficMarkupPercent);
  if (!normalizedTrafficMarkupPercent) {
    return report;
  }

  const trafficTrend = report.trafficTrend.map((point) => ({
    ...point,
    value: applyTrafficMarkupToGb(point.value, normalizedTrafficMarkupPercent),
  }));
  const totalTrafficGb = Number(trafficTrend.reduce((sum, point) => sum + point.value, 0).toFixed(2));
  const trafficUsageTable = report.trafficUsageTable.map((row) => ({
    ...row,
    traffic: formatTrafficFromGb(
      applyTrafficMarkupToGb(parseTrafficToGb(row.traffic), normalizedTrafficMarkupPercent),
      locale,
    ),
  }));
  const regionalTrafficTable = report.regionalTrafficTable.map((row) => ({
    ...row,
    traffic:
      row.traffic === "--"
        ? row.traffic
        : formatTrafficFromGb(
            applyTrafficMarkupToGb(parseTrafficToGb(row.traffic), normalizedTrafficMarkupPercent),
            locale,
          ),
    cost:
      row.cost === "--"
        ? row.cost
        : formatUsd(applyTrafficMarkupToUsd(parseUsd(row.cost), normalizedTrafficMarkupPercent), locale),
  }));
  const metrics = report.metrics.map((metric, index) =>
    index === 0
      ? {
          ...metric,
          value: formatTrafficFromGb(totalTrafficGb, locale),
        }
      : metric,
  );

  return {
    ...report,
    metrics,
    trafficTrend,
    trafficUsageTable,
    regionalTrafficTable,
    regionalTrafficTotalCost:
      report.regionalTrafficTotalCost === "--"
        ? "--"
        : formatUsd(
            applyTrafficMarkupToUsd(parseUsd(report.regionalTrafficTotalCost), normalizedTrafficMarkupPercent),
            locale,
          ),
  };
}

function formatMetricTime(value?: string) {
  if (!value) {
    return "--";
  }

  const [date = "", time = ""] = value.split(" ");
  return date.length >= 10 ? `${date.slice(5)} ${time.slice(0, 5)}` : value;
}

function aggregateSeriesPoints(
  reports: LiveDomainReportData[],
  key: "trafficTrend" | "peakBandwidth",
) {
  const order: string[] = [];
  const pointMap = new Map<string, { label: string; tooltipLabel: string; value: number }>();

  for (const report of reports) {
    for (const point of report[key]) {
      const pointKey = point.tooltipLabel ?? point.label;
      const existing = pointMap.get(pointKey);

      if (!existing) {
        order.push(pointKey);
        pointMap.set(pointKey, {
          label: point.label,
          tooltipLabel: point.tooltipLabel ?? point.label,
          value: point.value,
        });
        continue;
      }

      existing.value += point.value;
    }
  }

  return order.map((pointKey) => {
    const point = pointMap.get(pointKey)!;
    return {
      label: point.label,
      tooltipLabel: point.tooltipLabel,
      value: Number(point.value.toFixed(2)),
    };
  });
}

function aggregateTrafficUsageTable(reports: LiveDomainReportData[], locale: Locale): TableRow[] {
  const rowMap = new Map<string, { trafficGb: number; peakMbps: number }>();

  for (const report of reports) {
    for (const row of report.trafficUsageTable) {
      const existing = rowMap.get(row.period) ?? { trafficGb: 0, peakMbps: 0 };
      existing.trafficGb += parseTrafficToGb(row.traffic);
      existing.peakMbps += parseBandwidthToMbps(row.peakBps);
      rowMap.set(row.period, existing);
    }
  }

  return Array.from(rowMap.entries()).map(([period, row]) => ({
    period,
    traffic: formatTrafficFromGb(row.trafficGb, locale),
    pv: "--",
    uv: "--",
    peakBps: formatBandwidthFromMbps(row.peakMbps, locale),
  }));
}

function aggregateRegionalTraffic(
  reports: LiveDomainReportData[],
  locale: Locale,
) {
  const regionMap = new Map<
    string,
    {
      region: string;
      trafficGb: number;
      costUsd: number;
      unitPrice: string;
    }
  >();

  for (const report of reports) {
    for (const row of report.regionalTrafficTable) {
      if (row.regionCode === "TOTAL") {
        continue;
      }

      const existing = regionMap.get(row.regionCode) ?? {
        region: row.region,
        trafficGb: 0,
        costUsd: 0,
        unitPrice: row.unitPrice,
      };

      existing.trafficGb += parseTrafficToGb(row.traffic);
      existing.costUsd += parseUsd(row.cost);
      regionMap.set(row.regionCode, existing);
    }
  }

  const totalTrafficGb = Array.from(regionMap.values()).reduce((sum, row) => sum + row.trafficGb, 0);
  const totalCostUsd = Array.from(regionMap.values()).reduce((sum, row) => sum + row.costUsd, 0);
  const rows = Array.from(regionMap.entries())
    .map(([regionCode, row]) => ({
      regionCode,
      region: row.region,
      traffic: formatTrafficFromGb(row.trafficGb, locale),
      share: `${(totalTrafficGb > 0 ? (row.trafficGb / totalTrafficGb) * 100 : 0).toLocaleString(
        locale === "en" ? "en-US" : "zh-CN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )}%`,
      unitPrice: row.unitPrice,
      cost: formatUsd(row.costUsd, locale),
      trafficGb: row.trafficGb,
      costUsd: row.costUsd,
    }))
    .sort((left, right) => right.trafficGb - left.trafficGb);

  return {
    rows: [
      ...rows.map(({ trafficGb: _trafficGb, costUsd: _costUsd, ...row }) => row),
      {
        regionCode: "TOTAL",
        region: locale === "en" ? "Total" : "总计",
        traffic: formatTrafficFromGb(totalTrafficGb, locale),
        share: "100.00%",
        unitPrice: "--",
        cost: formatUsd(totalCostUsd, locale),
      },
    ],
    totalCost: formatUsd(totalCostUsd, locale),
  };
}

function formatLocalDateTimeAtOffset(date: Date, offsetMinutes: number) {
  const parts = getDatePartsAtOffset(date, offsetMinutes);
  return formatLocalDateTime(parts.year, parts.month, parts.day, parts.hour, parts.minute);
}

function formatCountValue(value: number, locale: Locale) {
  return Math.round(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN");
}

function formatAverageCountValue(value: number, locale: Locale) {
  return value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function formatMetricTooltipLabel(tooltipLabel?: string) {
  if (!tooltipLabel) {
    return "--";
  }

  return tooltipLabel.length >= 16 ? tooltipLabel.slice(5, 16) : tooltipLabel;
}

function formatPercent(value: number, locale: Locale) {
  return `${value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function isHardcodedMrsukanCutoverCustomer(customer: Pick<CustomerRecord, "authCode">) {
  return customer.authCode === MRSUKAN_REPORT_CUTOVER.authCode;
}

const LONG_RANGE_SEGMENT_MS = 31 * 24 * 60 * 60 * 1000;
const LONG_RANGE_SEGMENT_STEP_MS = 60 * 1000;

function buildHardcodedQueryFiltersForUtcWindow(filters: ReportFilters, startUtc: Date, endUtc: Date): ReportFilters {
  const offsetMinutes = filters.timeZoneOffsetMinutes ?? 8 * 60;

  return {
    ...filters,
    allowLongRange: false,
    timeRange: "custom",
    from: formatLocalDateTimeAtOffset(startUtc, offsetMinutes),
    to: formatLocalDateTimeAtOffset(endUtc, offsetMinutes),
  };
}

function shouldSegmentLongRangeFilters(filters: ReportFilters) {
  if (!filters.allowLongRange || filters.timeRange !== "custom" || !filters.from || !filters.to) {
    return false;
  }

  const window = resolveReportWindow(filters);
  const startUtc = new Date(window.startTime);
  const endUtc = new Date(window.endTime);

  return endUtc.getTime() - startUtc.getTime() > LONG_RANGE_SEGMENT_MS;
}

function splitLongRangeReportFilters(filters: ReportFilters) {
  const window = resolveReportWindow(filters);
  const segments: ReportFilters[] = [];
  const endUtc = new Date(window.endTime);
  let cursorUtc = new Date(window.startTime);

  while (cursorUtc.getTime() <= endUtc.getTime()) {
    const nextEndUtc = new Date(
      Math.min(cursorUtc.getTime() + LONG_RANGE_SEGMENT_MS - LONG_RANGE_SEGMENT_STEP_MS, endUtc.getTime()),
    );

    segments.push(buildHardcodedQueryFiltersForUtcWindow(filters, cursorUtc, nextEndUtc));

    if (nextEndUtc.getTime() >= endUtc.getTime()) {
      break;
    }

    cursorUtc = new Date(nextEndUtc.getTime() + LONG_RANGE_SEGMENT_STEP_MS);
  }

  return segments;
}

async function buildSegmentedLiveDomainReport(
  domain: string,
  filters: ReportFilters,
  locale: Locale,
): Promise<LiveDomainReportResult> {
  if (!shouldSegmentLongRangeFilters(filters)) {
    return fetchLiveDomainReportResult(domain, filters, locale);
  }

  const reports: LiveDomainReportData[] = [];

  for (const segmentFilters of splitLongRangeReportFilters(filters)) {
    const result = await fetchLiveDomainReportResult(domain, segmentFilters, locale);

    if (result.reason && result.reason !== "empty") {
      return {
        data: null,
        reason: result.reason,
      };
    }

    if (result.data) {
      reports.push(result.data);
    }
  }

  if (reports.length === 0) {
    return {
      data: null,
      reason: "empty",
    };
  }

  return {
    data: reports.length === 1 ? reports[0] : mergeLiveDomainReports(reports, locale, filters),
    reason: null,
  };
}

function resolveHardcodedMrsukanDomainSegments(
  customer: Pick<CustomerRecord, "authCode">,
  filters: ReportFilters,
  selectedDomain?: string | null,
): HardcodedDomainQuerySegment[] | null {
  if (!isHardcodedMrsukanCutoverCustomer(customer)) {
    return null;
  }

  const window = resolveReportWindow(filters);
  const queryStartUtc = new Date(window.startTime);
  const queryEndUtc = new Date(window.endTime);
  const cutoverUtc = MRSUKAN_REPORT_CUTOVER.cutoverUtc;
  const requestedLegacyDomain = selectedDomain === MRSUKAN_REPORT_CUTOVER.legacyDomain;
  const requestedNextDomain = selectedDomain === MRSUKAN_REPORT_CUTOVER.nextDomain;

  if (requestedLegacyDomain) {
    if (queryStartUtc.getTime() >= cutoverUtc.getTime()) {
      return [];
    }

    return [
      {
        domain: MRSUKAN_REPORT_CUTOVER.legacyDomain,
        filters:
          queryEndUtc.getTime() <= cutoverUtc.getTime()
            ? filters
            : buildHardcodedQueryFiltersForUtcWindow(
                filters,
                queryStartUtc,
                new Date(cutoverUtc.getTime() - 60 * 1000),
              ),
      },
    ];
  }

  if (requestedNextDomain) {
    if (queryEndUtc.getTime() <= cutoverUtc.getTime()) {
      return [];
    }

    return [
      {
        domain: MRSUKAN_REPORT_CUTOVER.nextDomain,
        filters:
          queryStartUtc.getTime() >= cutoverUtc.getTime()
            ? filters
            : buildHardcodedQueryFiltersForUtcWindow(filters, cutoverUtc, queryEndUtc),
      },
    ];
  }

  if (queryEndUtc.getTime() <= cutoverUtc.getTime()) {
    return [
      {
        domain: MRSUKAN_REPORT_CUTOVER.legacyDomain,
        filters,
      },
    ];
  }

  if (queryStartUtc.getTime() >= cutoverUtc.getTime()) {
    return [
      {
        domain: MRSUKAN_REPORT_CUTOVER.nextDomain,
        filters,
      },
    ];
  }

  return [
    {
      domain: MRSUKAN_REPORT_CUTOVER.legacyDomain,
      filters: buildHardcodedQueryFiltersForUtcWindow(
        filters,
        queryStartUtc,
        new Date(cutoverUtc.getTime() - 60 * 1000),
      ),
    },
    {
      domain: MRSUKAN_REPORT_CUTOVER.nextDomain,
      filters: buildHardcodedQueryFiltersForUtcWindow(filters, cutoverUtc, queryEndUtc),
    },
  ];
}

function mergeReportSeriesPoints(reports: LiveDomainReportData[], key: "trafficTrend" | "peakBandwidth") {
  const pointMap = new Map<string, { label: string; tooltipLabel?: string; value: number }>();

  for (const report of reports) {
    for (const point of report[key]) {
      const pointKey = point.tooltipLabel ?? point.label;
      const current = pointMap.get(pointKey) ?? {
        label: point.label,
        tooltipLabel: point.tooltipLabel,
        value: 0,
      };

      current.value += point.value;
      pointMap.set(pointKey, current);
    }
  }

  return Array.from(pointMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => ({
      label: point.label,
      tooltipLabel: point.tooltipLabel,
      value: Number(point.value.toFixed(2)),
    }));
}

function mergeReportDualSeriesPoints(reports: LiveDomainReportData[]) {
  const pointMap = new Map<string, { label: string; tooltipLabel?: string; primary: number; secondary: number }>();

  for (const report of reports) {
    for (const point of report.pvUvTrend) {
      const pointKey = point.tooltipLabel ?? point.label;
      const current = pointMap.get(pointKey) ?? {
        label: point.label,
        tooltipLabel: point.tooltipLabel,
        primary: 0,
        secondary: 0,
      };

      current.primary += point.primary;
      current.secondary += point.secondary;
      pointMap.set(pointKey, current);
    }
  }

  return Array.from(pointMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => ({
      label: point.label,
      tooltipLabel: point.tooltipLabel,
      primary: Math.round(point.primary),
      secondary: Math.round(point.secondary),
    }));
}

function mergeReportTables(
  reports: LiveDomainReportData[],
  key: "trafficUsageTable" | "audienceUsageTable",
  locale: Locale,
) {
  const rowMap = new Map<string, { trafficGb: number; pv: number; uv: number; peakMbps: number }>();

  for (const report of reports) {
    for (const row of report[key]) {
      const current = rowMap.get(row.period) ?? {
        trafficGb: 0,
        pv: 0,
        uv: 0,
        peakMbps: 0,
      };

      current.trafficGb += parseTrafficToGb(row.traffic);
      current.pv += parseLocalizedNumber(row.pv);
      current.uv += parseLocalizedNumber(row.uv);
      current.peakMbps += parseBandwidthToMbps(row.peakBps);
      rowMap.set(row.period, current);
    }
  }

  return Array.from(rowMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, row]) => ({
      period,
      traffic: formatTrafficFromGb(row.trafficGb, locale),
      pv: formatCountValue(row.pv, locale),
      uv: formatCountValue(row.uv, locale),
      peakBps: formatBandwidthFromMbps(row.peakMbps, locale),
    }));
}

function mergeRegionalTrafficRows(reports: LiveDomainReportData[], locale: Locale) {
  const rowMap = new Map<
    string,
    {
      region: string;
      trafficGb: number;
      costUsd: number;
      unitPrice: string;
    }
  >();

  for (const report of reports) {
    for (const row of report.regionalTrafficTable) {
      if (row.regionCode === "TOTAL") {
        continue;
      }

      const current = rowMap.get(row.regionCode) ?? {
        region: row.region,
        trafficGb: 0,
        costUsd: 0,
        unitPrice: row.unitPrice,
      };

      current.trafficGb += parseTrafficToGb(row.traffic);
      current.costUsd += parseUsd(row.cost);
      rowMap.set(row.regionCode, current);
    }
  }

  const totalTrafficGb = Array.from(rowMap.values()).reduce((sum, row) => sum + row.trafficGb, 0);
  const totalCostUsd = Array.from(rowMap.values()).reduce((sum, row) => sum + row.costUsd, 0);
  const rows = Array.from(rowMap.entries())
    .map(([regionCode, row]) => ({
      regionCode,
      region: row.region,
      traffic: formatTrafficFromGb(row.trafficGb, locale),
      share: formatPercent(totalTrafficGb > 0 ? (row.trafficGb / totalTrafficGb) * 100 : 0, locale),
      unitPrice: row.unitPrice,
      cost: formatUsd(row.costUsd, locale),
      trafficGb: row.trafficGb,
    }))
    .sort((left, right) => right.trafficGb - left.trafficGb);

  if (rows.length === 0) {
    return {
      rows: [] as RegionTrafficRow[],
      totalCost: "--",
    };
  }

  return {
    rows: [
      ...rows.map(({ trafficGb: _trafficGb, ...row }) => row),
      {
        regionCode: "TOTAL",
        region: locale === "en" ? "Total" : "总计",
        traffic: formatTrafficFromGb(totalTrafficGb, locale),
        share: formatPercent(100, locale),
        unitPrice: "--",
        cost: formatUsd(totalCostUsd, locale),
      },
    ],
    totalCost: formatUsd(totalCostUsd, locale),
  };
}

function buildMergedLiveReportMetrics(
  locale: Locale,
  syncText: string,
  trafficTrend: LiveDomainReportData["trafficTrend"],
  peakBandwidth: LiveDomainReportData["peakBandwidth"],
  pvUvTrend: LiveDomainReportData["pvUvTrend"],
): Metric[] {
  const totalTrafficGb = trafficTrend.reduce((sum, point) => sum + point.value, 0);
  const averageBandwidthMbps =
    peakBandwidth.length > 0
      ? peakBandwidth.reduce((sum, point) => sum + point.value, 0) / peakBandwidth.length
      : 0;
  const peakBandwidthPoint = peakBandwidth.reduce<(typeof peakBandwidth)[number] | null>(
    (peak, point) => (!peak || point.value > peak.value ? point : peak),
    null,
  );
  const averageUv =
    pvUvTrend.length > 0 ? pvUvTrend.reduce((sum, point) => sum + point.secondary, 0) / pvUvTrend.length : 0;
  const peakUvPoint = pvUvTrend.reduce<(typeof pvUvTrend)[number] | null>(
    (peak, point) => (!peak || point.secondary > peak.secondary ? point : peak),
    null,
  );
  const averagePv =
    pvUvTrend.length > 0 ? pvUvTrend.reduce((sum, point) => sum + point.primary, 0) / pvUvTrend.length : 0;

  if (locale === "en") {
    return [
      { label: "Total Traffic", value: formatTrafficFromGb(totalTrafficGb, locale), delta: syncText, tone: "brand" },
      {
        label: "Average Bandwidth",
        value: formatBandwidthFromMbps(averageBandwidthMbps, locale),
        delta: syncText,
        tone: "success",
      },
      {
        label: "Peak Bandwidth",
        value: formatBandwidthFromMbps(peakBandwidthPoint?.value ?? 0, locale),
        delta: syncText,
        tone: "warning",
      },
      {
        label: "Peak Bandwidth Time",
        value: formatMetricTooltipLabel(peakBandwidthPoint?.tooltipLabel),
        delta: syncText,
        tone: "brand",
      },
      {
        label: "UV Peak",
        value: formatCountValue(peakUvPoint?.secondary ?? 0, locale),
        delta: syncText,
        tone: "warning",
      },
      {
        label: "Average UV",
        value: formatAverageCountValue(averageUv, locale),
        delta: syncText,
        tone: "success",
      },
      {
        label: "UV Peak Time",
        value: formatMetricTooltipLabel(peakUvPoint?.tooltipLabel),
        delta: syncText,
        tone: "brand",
      },
      {
        label: "Average PV",
        value: formatAverageCountValue(averagePv, locale),
        delta: syncText,
        tone: "brand",
      },
    ];
  }

  return [
    { label: "累计流量", value: formatTrafficFromGb(totalTrafficGb, locale), delta: syncText, tone: "brand" },
    { label: "平均带宽", value: formatBandwidthFromMbps(averageBandwidthMbps, locale), delta: syncText, tone: "success" },
    { label: "带宽峰值", value: formatBandwidthFromMbps(peakBandwidthPoint?.value ?? 0, locale), delta: syncText, tone: "warning" },
    { label: "峰值时间", value: formatMetricTooltipLabel(peakBandwidthPoint?.tooltipLabel), delta: syncText, tone: "brand" },
    { label: "UV 峰值", value: formatCountValue(peakUvPoint?.secondary ?? 0, locale), delta: syncText, tone: "warning" },
    { label: "平均 UV", value: formatAverageCountValue(averageUv, locale), delta: syncText, tone: "success" },
    { label: "UV 峰值时间", value: formatMetricTooltipLabel(peakUvPoint?.tooltipLabel), delta: syncText, tone: "brand" },
    { label: "平均 PV", value: formatAverageCountValue(averagePv, locale), delta: syncText, tone: "brand" },
  ];
}

function mergeLiveDomainReports(
  reports: LiveDomainReportData[],
  locale: Locale,
  filters: ReportFilters,
): LiveDomainReportData {
  const trafficTrend = mergeReportSeriesPoints(reports, "trafficTrend");
  const peakBandwidth = mergeReportSeriesPoints(reports, "peakBandwidth");
  const pvUvTrend = mergeReportDualSeriesPoints(reports);
  const trafficUsageTable = mergeReportTables(reports, "trafficUsageTable", locale);
  const audienceUsageTable = mergeReportTables(reports, "audienceUsageTable", locale);
  const regionalTrafficComplete = reports.every((report) => report.regionalTrafficComplete !== false);
  const mergedRegionalTraffic = mergeRegionalTrafficRows(reports, locale);
  const window = resolveReportWindow(filters);
  const syncText =
    locale === "en"
      ? `Alibaba Cloud • ${window.fromDisplay} - ${window.toDisplay}`
      : `阿里云 • ${window.fromDisplay} - ${window.toDisplay}`;

  return {
    metrics: buildMergedLiveReportMetrics(locale, syncText, trafficTrend, peakBandwidth, pvUvTrend),
    syncText,
    trafficTrend,
    peakBandwidth,
    pvUvTrend,
    trafficUsageTable,
    audienceUsageTable,
    regionalTrafficTable: regionalTrafficComplete ? mergedRegionalTraffic.rows : [],
    regionalTrafficTotalCost: regionalTrafficComplete ? mergedRegionalTraffic.totalCost : "--",
    regionalTrafficComplete,
  };
}

async function buildHardcodedMrsukanReport(
  customer: CustomerRecord,
  filters: ReportFilters,
  locale: Locale,
  selectedDomain?: string | null,
): Promise<LiveDomainReportResult> {
  if (shouldSegmentLongRangeFilters(filters)) {
    const reports: LiveDomainReportData[] = [];

    for (const segmentFilters of splitLongRangeReportFilters(filters)) {
      const result = await buildHardcodedMrsukanReport(customer, segmentFilters, locale, selectedDomain);

      if (result.reason && result.reason !== "empty") {
        return {
          data: null,
          reason: result.reason,
        };
      }

      if (result.data) {
        reports.push(result.data);
      }
    }

    if (reports.length === 0) {
      return {
        data: null,
        reason: "empty",
      };
    }

    return {
      data: reports.length === 1 ? reports[0] : mergeLiveDomainReports(reports, locale, filters),
      reason: null,
    };
  }

  const segments = resolveHardcodedMrsukanDomainSegments(customer, filters, selectedDomain);
  if (!segments) {
    return {
      data: null,
      reason: "request_failed",
    };
  }

  if (segments.length === 0) {
    return {
      data: null,
      reason: "empty",
    };
  }

  const reports: LiveDomainReportData[] = [];

  for (const segment of segments) {
    const result = await fetchLiveDomainReportResult(segment.domain, segment.filters, locale);

    if (result.reason && result.reason !== "empty") {
      return {
        data: null,
        reason: result.reason,
      };
    }

    if (result.data) {
      reports.push(result.data);
    }
  }

  if (reports.length === 0) {
    return {
      data: null,
      reason: "empty",
    };
  }

  return {
    data: reports.length === 1 ? reports[0] : mergeLiveDomainReports(reports, locale, filters),
    reason: null,
  };
}

async function buildHardcodedMrsukanTrafficSummary(customer: CustomerRecord, filters: ReportFilters) {
  const segments = resolveHardcodedMrsukanDomainSegments(customer, filters);
  if (!segments) {
    return {
      totalTrafficGb: 0,
      matchedDomainCount: 0,
      failureReason: "request_failed" as LiveDomainReportFailureReason,
    };
  }

  let totalTrafficGb = 0;
  let hasMatchedSegment = false;

  for (const segment of segments) {
    const result = await fetchLiveDomainTrafficSummaryResult(segment.domain, segment.filters);

    if (result.reason && result.reason !== "empty") {
      return {
        totalTrafficGb: 0,
        matchedDomainCount: 0,
        failureReason: result.reason,
      };
    }

    if (result.data) {
      hasMatchedSegment = true;
      totalTrafficGb += result.data.totalTrafficGb;
    }
  }

  return {
    totalTrafficGb: Number(totalTrafficGb.toFixed(2)),
    matchedDomainCount: hasMatchedSegment ? 1 : 0,
    failureReason: hasMatchedSegment ? null : ("empty" as LiveDomainReportFailureReason),
  };
}

async function buildHardcodedMrsukanRegionalTrafficSummary(
  customer: CustomerRecord,
  filters: ReportFilters,
  locale: Locale,
): Promise<{
  totalTrafficGb: number;
  totalCostUsd: number;
  matchedDomainCount: number;
  failureReason: LiveDomainReportFailureReason | null;
}> {
  if (shouldSegmentLongRangeFilters(filters)) {
    let totalTrafficGb = 0;
    let totalCostUsd = 0;
    let matchedDomainCount = 0;

    for (const segmentFilters of splitLongRangeReportFilters(filters)) {
      const result = await buildHardcodedMrsukanRegionalTrafficSummary(customer, segmentFilters, locale);

      if (result.failureReason && result.failureReason !== "empty") {
        return {
          totalTrafficGb: 0,
          totalCostUsd: 0,
          matchedDomainCount: 0,
          failureReason: result.failureReason,
        };
      }

      if (result.matchedDomainCount > 0) {
        totalTrafficGb += result.totalTrafficGb;
        totalCostUsd += result.totalCostUsd;
        matchedDomainCount = Math.max(matchedDomainCount, result.matchedDomainCount);
      }
    }

    return {
      totalTrafficGb: Number(totalTrafficGb.toFixed(2)),
      totalCostUsd: Number(totalCostUsd.toFixed(2)),
      matchedDomainCount,
      failureReason: matchedDomainCount > 0 ? null : ("empty" as LiveDomainReportFailureReason),
    };
  }

  const segments = resolveHardcodedMrsukanDomainSegments(customer, filters);
  if (!segments) {
    return {
      totalTrafficGb: 0,
      totalCostUsd: 0,
      matchedDomainCount: 0,
      failureReason: "request_failed" as LiveDomainReportFailureReason,
    };
  }

  let totalTrafficGb = 0;
  let totalCostUsd = 0;
  let hasMatchedSegment = false;

  for (const segment of segments) {
    const result = await fetchLiveDomainRegionalTrafficSummaryResult(segment.domain, segment.filters, locale);

    if (result.reason && result.reason !== "empty") {
      return {
        totalTrafficGb: 0,
        totalCostUsd: 0,
        matchedDomainCount: 0,
        failureReason: result.reason,
      };
    }

    if (result.data) {
      hasMatchedSegment = true;
      totalTrafficGb += result.data.totalTrafficGb;
      totalCostUsd += result.data.totalCostUsd;
    }
  }

  return {
    totalTrafficGb: Number(totalTrafficGb.toFixed(2)),
    totalCostUsd: Number(totalCostUsd.toFixed(2)),
    matchedDomainCount: hasMatchedSegment ? 1 : 0,
    failureReason: hasMatchedSegment ? null : ("empty" as LiveDomainReportFailureReason),
  };
}

function buildAllDomainsTrafficMetrics(
  locale: Locale,
  syncText: string,
  trafficTrend: LiveDomainReportData["trafficTrend"],
  peakBandwidth: LiveDomainReportData["peakBandwidth"],
): Metric[] {
  const totalTrafficGb = trafficTrend.reduce((sum, point) => sum + point.value, 0);
  const averageBandwidthMbps =
    peakBandwidth.length > 0
      ? peakBandwidth.reduce((sum, point) => sum + point.value, 0) / peakBandwidth.length
      : 0;
  const peakBandwidthPoint = peakBandwidth.reduce<(typeof peakBandwidth)[number] | null>(
    (peak, point) => (!peak || point.value > peak.value ? point : peak),
    null,
  );

  return [
    {
      label: locale === "en" ? "Total Traffic" : "累计流量",
      value: formatTrafficFromGb(totalTrafficGb, locale),
      delta: syncText,
      tone: "brand",
    },
    {
      label: locale === "en" ? "Average Bandwidth" : "平均带宽",
      value: formatBandwidthFromMbps(averageBandwidthMbps, locale),
      delta: syncText,
      tone: "success",
    },
    {
      label: locale === "en" ? "Peak Bandwidth" : "带宽峰值",
      value: formatBandwidthFromMbps(peakBandwidthPoint?.value ?? 0, locale),
      delta: syncText,
      tone: "warning",
    },
    {
      label: locale === "en" ? "Peak Bandwidth Time" : "峰值时间",
      value: formatMetricTime(peakBandwidthPoint?.tooltipLabel),
      delta: syncText,
      tone: "brand",
    },
    { label: locale === "en" ? "UV Peak" : "UV 峰值", value: "--", delta: syncText, tone: "warning" },
    { label: locale === "en" ? "Average UV" : "平均 UV", value: "--", delta: syncText, tone: "success" },
    { label: locale === "en" ? "UV Peak Time" : "UV 峰值时间", value: "--", delta: syncText, tone: "brand" },
    { label: locale === "en" ? "Average PV" : "平均 PV", value: "--", delta: syncText, tone: "brand" },
  ];
}

async function buildAllDomainsTrafficReport(
  domains: string[],
  filters: ReportFilters,
  locale: Locale,
): Promise<{
  report: LiveDomainReportData | null;
  matchedDomainCount: number;
  failureReason: LiveDomainReportFailureReason | null;
}> {
  if (shouldSegmentLongRangeFilters(filters)) {
    const reports: LiveDomainReportData[] = [];
    let matchedDomainCount = 0;

    for (const segmentFilters of splitLongRangeReportFilters(filters)) {
      const result = await buildAllDomainsTrafficReport(domains, segmentFilters, locale);

      if (result.failureReason && result.failureReason !== "empty") {
        return {
          report: null,
          matchedDomainCount: 0,
          failureReason: result.failureReason,
        };
      }

      if (result.report) {
        reports.push(result.report);
        matchedDomainCount = Math.max(matchedDomainCount, result.matchedDomainCount);
      }
    }

    if (reports.length === 0) {
      return {
        report: null,
        matchedDomainCount: 0,
        failureReason: "empty" as LiveDomainReportFailureReason,
      };
    }

    return {
      report: reports.length === 1 ? reports[0] : mergeLiveDomainReports(reports, locale, filters),
      matchedDomainCount,
      failureReason: null,
    };
  }

  const results: Array<{
    domain: string;
    result: LiveDomainReportResult;
  }> = [];

  for (const domain of domains) {
    results.push({
      domain,
      result: await fetchLiveDomainReportResult(domain, filters, locale),
    });
  }

  for (const entry of results) {
    if (entry.result.reason !== "request_failed") {
      continue;
    }

    entry.result = await fetchLiveDomainReportResult(entry.domain, filters, locale);
  }

  const reports = results
    .map((entry) => entry.result.data)
    .filter((report): report is LiveDomainReportData => Boolean(report));
  const failedResults = results.filter(
    (entry) =>
      entry.result.reason === "request_failed" || entry.result.reason === "domain_not_found",
  );
  const accountedDomainCount = results.filter(
    (entry) => Boolean(entry.result.data) || entry.result.reason === "empty",
  ).length;

  if (failedResults.length > 0) {
    return {
      report: null,
      matchedDomainCount: accountedDomainCount,
      failureReason: failedResults.some((entry) => entry.result.reason === "domain_not_found")
        ? ("domain_not_found" as const)
        : ("request_failed" as const),
    };
  }

  if (reports.length === 0) {
    const reasons = new Set(
      results
        .map((entry) => entry.result.reason)
        .filter((reason): reason is LiveDomainReportFailureReason => Boolean(reason)),
    );

    let failureReason: LiveDomainReportFailureReason = "request_failed";
    if (reasons.has("empty")) {
      failureReason = "empty";
    } else if (reasons.has("domain_not_found")) {
      failureReason = "domain_not_found";
    }

    return {
      report: null,
      matchedDomainCount: 0,
      failureReason,
    };
  }

  const trafficTrend = aggregateSeriesPoints(reports, "trafficTrend");
  const peakBandwidth = aggregateSeriesPoints(reports, "peakBandwidth");
  const aggregatedRegional = aggregateRegionalTraffic(reports, locale);
  const regionalTrafficComplete = reports.every((report) => report.regionalTrafficComplete !== false);
  const syncText = reports[0]?.syncText ?? (locale === "en" ? "Alibaba Cloud" : "阿里云");

  return {
    report: {
      metrics: buildAllDomainsTrafficMetrics(locale, syncText, trafficTrend, peakBandwidth),
      syncText,
      pvUvTrend: [] as DualSeriesPoint[],
      trafficTrend,
      peakBandwidth,
      trafficUsageTable: aggregateTrafficUsageTable(reports, locale),
      audienceUsageTable: [] as TableRow[],
      regionalTrafficTable: regionalTrafficComplete ? aggregatedRegional.rows : [],
      regionalTrafficTotalCost: regionalTrafficComplete ? aggregatedRegional.totalCost : "--",
      regionalTrafficComplete,
    },
    matchedDomainCount: accountedDomainCount,
    failureReason: null,
  };
}

async function buildAllDomainsTrafficSummary(
  domains: string[],
  filters: ReportFilters,
) {
  const results = await Promise.all(
    domains.map((domain) => fetchLiveDomainTrafficSummaryResult(domain, filters)),
  );
  const summaries = results
    .map((result) => result.data)
    .filter((summary): summary is { totalTrafficGb: number } => Boolean(summary));

  if (summaries.length === 0) {
    const reasons = new Set(
      results
        .map((result) => result.reason)
        .filter((reason): reason is LiveDomainReportFailureReason => Boolean(reason)),
    );

    let failureReason: LiveDomainReportFailureReason = "request_failed";
    if (reasons.has("empty")) {
      failureReason = "empty";
    } else if (reasons.has("domain_not_found")) {
      failureReason = "domain_not_found";
    }

    return {
      totalTrafficGb: 0,
      matchedDomainCount: 0,
      failureReason,
    };
  }

  return {
    totalTrafficGb: Number(summaries.reduce((sum, summary) => sum + summary.totalTrafficGb, 0).toFixed(2)),
    matchedDomainCount: summaries.length,
    failureReason: null,
  };
}

async function buildAllDomainsRegionalTrafficSummary(
  domains: string[],
  filters: ReportFilters,
  locale: Locale,
): Promise<{
  totalTrafficGb: number;
  totalCostUsd: number;
  matchedDomainCount: number;
  failureReason: LiveDomainReportFailureReason | null;
}> {
  if (shouldSegmentLongRangeFilters(filters)) {
    let totalTrafficGb = 0;
    let totalCostUsd = 0;
    let matchedDomainCount = 0;

    for (const segmentFilters of splitLongRangeReportFilters(filters)) {
      const result = await buildAllDomainsRegionalTrafficSummary(domains, segmentFilters, locale);

      if (result.failureReason && result.failureReason !== "empty") {
        return {
          totalTrafficGb: 0,
          totalCostUsd: 0,
          matchedDomainCount: 0,
          failureReason: result.failureReason,
        };
      }

      if (result.matchedDomainCount > 0) {
        totalTrafficGb += result.totalTrafficGb;
        totalCostUsd += result.totalCostUsd;
        matchedDomainCount = Math.max(matchedDomainCount, result.matchedDomainCount);
      }
    }

    return {
      totalTrafficGb: Number(totalTrafficGb.toFixed(2)),
      totalCostUsd: Number(totalCostUsd.toFixed(2)),
      matchedDomainCount,
      failureReason: matchedDomainCount > 0 ? null : ("empty" as LiveDomainReportFailureReason),
    };
  }

  const results: Array<{
    domain: string;
    result: Awaited<ReturnType<typeof fetchLiveDomainRegionalTrafficSummaryResult>>;
  }> = [];

  for (const domain of domains) {
    results.push({
      domain,
      result: await fetchLiveDomainRegionalTrafficSummaryResult(domain, filters, locale),
    });
  }

  for (const entry of results) {
    if (entry.result.reason !== "request_failed") {
      continue;
    }

    entry.result = await fetchLiveDomainRegionalTrafficSummaryResult(entry.domain, filters, locale);
  }

  const summaries = results
    .map((entry) => entry.result.data)
    .filter((summary): summary is { totalTrafficGb: number; totalCostUsd: number } => Boolean(summary));

  if (summaries.length === 0) {
    const reasons = new Set(
      results
        .map((entry) => entry.result.reason)
        .filter((reason): reason is LiveDomainReportFailureReason => Boolean(reason)),
    );

    let failureReason: LiveDomainReportFailureReason = "request_failed";
    if (reasons.has("empty")) {
      failureReason = "empty";
    } else if (reasons.has("domain_not_found")) {
      failureReason = "domain_not_found";
    }

    return {
      totalTrafficGb: 0,
      totalCostUsd: 0,
      matchedDomainCount: 0,
      failureReason,
    };
  }

  return {
    totalTrafficGb: Number(summaries.reduce((sum, summary) => sum + summary.totalTrafficGb, 0).toFixed(2)),
    totalCostUsd: Number(summaries.reduce((sum, summary) => sum + summary.totalCostUsd, 0).toFixed(2)),
    matchedDomainCount: summaries.length,
    failureReason:
      summaries.length < domains.length
        ? results.some((entry) => entry.result.reason === "domain_not_found")
          ? ("domain_not_found" as const)
          : ("request_failed" as const)
        : null,
  };
}

function buildTrafficBoardBaseRow(
  customer: CustomerRecord,
  locale: Locale,
  period: TrafficBoardPeriod,
  now: Date,
) {
  const trafficWindow = buildTrafficBoardFilters(period, customer.renewalDay, locale, now);
  const shouldFetchLiveData = customer.status === "正常" && customer.domains.length > 0;
  const baseRow: TrafficBoardRow = {
    customerId: customer.id,
    customerName: customer.name,
    status: customer.status,
    renewalDay: customer.renewalDay,
    renewalDayDisplay: formatRenewalDayDisplay(customer.renewalDay, locale),
    cycleRange: trafficWindow.cycleRange,
    domainCount: customer.domains.length,
    traffic: "--",
    reportHref: buildTrafficBoardReportHref(customer, period, trafficWindow.filters),
    hasLiveData: false,
    trafficGb: 0,
    trafficCost: null,
    trafficCostUsd: 0,
    trafficCostCanRetry: false,
    cycleWaiverTrafficFee: customer.monthlyGiftCreditUsd
      ? formatUsd(customer.monthlyGiftCreditUsd, locale)
      : null,
    cycleOverspend: formatUsd(0, locale),
    cycleOverspendUsd: 0,
    newCustomerGiftCredit: customer.cumulativeGiftCreditUsd
      ? formatUsd(customer.cumulativeGiftCreditUsd, locale)
      : null,
    newCustomerGiftCreditUsd: customer.cumulativeGiftCreditUsd ?? 0,
    availableRecharge: customer.availableRechargeUsd ? formatUsd(customer.availableRechargeUsd, locale) : null,
    availableRechargeUsd: customer.availableRechargeUsd ?? customer.cumulativeRechargeUsd ?? 0,
    cumulativeRecharge: customer.cumulativeRechargeUsd
      ? formatUsd(customer.cumulativeRechargeUsd, locale)
      : null,
    cumulativeRechargeUsd: customer.cumulativeRechargeUsd ?? 0,
    remainingBalance: null,
    remainingBalanceUsd: 0,
    pendingTopUp: null,
    pendingTopUpUsd: 0,
    trafficHint:
      customer.status !== "正常"
        ? getTrafficBoardHint(locale, "inactive")
        : customer.domains.length === 0
          ? getTrafficBoardHint(locale, "no_domains")
          : null,
    canRetry: false,
    trafficMarkupPercent: customer.trafficMarkupPercent,
    projectedMonthTraffic: null,
    projectedTrafficCost: null,
  };

  return {
    baseRow,
    filters: trafficWindow.filters,
    daysUntilRenewal: trafficWindow.daysUntilRenewal,
    windowElapsedDays: trafficWindow.windowElapsedDays,
    windowTotalDays: trafficWindow.windowTotalDays,
    shouldFetchLiveData,
  };
}

async function buildTrafficBoardLiveSnapshot(
  customer: CustomerRecord,
  locale: Locale,
  filters: ReportFilters,
) {
  const summaryResult = isHardcodedMrsukanCutoverCustomer(customer)
    ? await buildHardcodedMrsukanRegionalTrafficSummary(customer, filters, locale)
    : await buildAllDomainsRegionalTrafficSummary(customer.domains, filters, locale);
  const hasLiveData = summaryResult.matchedDomainCount > 0;
  const trafficGb = hasLiveData
    ? applyTrafficMarkupToGb(summaryResult.totalTrafficGb, customer.trafficMarkupPercent)
    : 0;
  let trafficCost: string | null = null;
  let trafficCostUsd = 0;
  let trafficCostCanRetry = false;
  const trafficHint = hasLiveData
    ? summaryResult.matchedDomainCount < customer.domains.length
      ? getTrafficBoardHint(
          locale,
          "partial_domains",
          summaryResult.matchedDomainCount,
          customer.domains.length,
        )
      : null
    : getTrafficBoardHint(locale, summaryResult.failureReason ?? "request_failed");
  const canRetry = hasLiveData
    ? summaryResult.matchedDomainCount < customer.domains.length
    : summaryResult.failureReason === "request_failed" || summaryResult.failureReason === "domain_not_found";

  if (hasLiveData) {
    trafficCostUsd = applyTrafficMarkupToUsd(summaryResult.totalCostUsd, customer.trafficMarkupPercent);
    trafficCost = formatUsd(trafficCostUsd, locale);
  }

  if (canRetry) {
    trafficCostCanRetry = true;
  }

  return {
    summaryResult,
    hasLiveData,
    trafficGb,
    trafficCost,
    trafficCostUsd,
    trafficCostCanRetry,
    trafficHint,
    canRetry,
  };
}

function buildCycleWaiverHistoryWindows(renewalDay: number | null, locale: Locale, now: Date, offsetMinutes = 8 * 60) {
  const [startYear, startMonth, startDay] = CLIENT_REPORT_MIN_DATE.split("-").map(Number);
  const historyStartUtc = Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
  const windows: Array<{ cycleRange: string; filters: ReportFilters }> = [];
  let cursor = new Date(now);

  while (cursor.getTime() >= historyStartUtc) {
    const cycleMeta = getCurrentBillingCycleMeta(renewalDay, locale, cursor, offsetMinutes);
    const effectiveStartUtc = Math.max(cycleMeta.cycleStartUtc, historyStartUtc);

    if (cursor.getTime() < effectiveStartUtc) {
      break;
    }

    const effectiveStartParts = getDatePartsAtOffset(new Date(effectiveStartUtc), offsetMinutes);
    const effectiveEndParts = getDatePartsAtOffset(cursor, offsetMinutes);

    windows.push({
      cycleRange: `${formatBillingRangeDate(effectiveStartParts.month, effectiveStartParts.day, locale)} - ${formatBillingRangeDate(
        effectiveEndParts.month,
        effectiveEndParts.day,
        locale,
      )}`,
      filters: {
        queryType: "traffic",
        timeRange: "custom",
        area: "all",
        from: formatLocalDateTime(
          effectiveStartParts.year,
          effectiveStartParts.month,
          effectiveStartParts.day,
          effectiveStartParts.hour,
          effectiveStartParts.minute,
        ),
        to: formatLocalDateTime(
          effectiveEndParts.year,
          effectiveEndParts.month,
          effectiveEndParts.day,
          effectiveEndParts.hour,
          effectiveEndParts.minute,
        ),
        timeZone: "Asia/Shanghai",
        timeZoneOffsetMinutes: offsetMinutes,
        locations: [],
      },
    });

    const previousCursorMs = cycleMeta.cycleStartUtc - 60 * 1000;
    if (previousCursorMs < historyStartUtc) {
      break;
    }
    cursor = new Date(previousCursorMs);
  }

  return windows;
}

function sanitizeTrafficBoardRowForAdmin(row: TrafficBoardRow, adminSession: AdminSession) {
  if (isSuperAdmin(adminSession)) {
    return row;
  }

  return {
    ...row,
    trafficMarkupPercent: null,
  };
}

async function buildTrafficBoardRow(
  customer: CustomerRecord,
  locale: Locale,
  period: TrafficBoardPeriod,
  now: Date,
  traceId?: string,
) {
  const startedAt = Date.now();
  const base = buildTrafficBoardBaseRow(customer, locale, period, now);
  const requestDebug = {
    traceId: traceId ?? null,
    customerId: customer.id,
    customerName: customer.name,
    status: customer.status,
    domainCount: customer.domains.length,
    domains: customer.domains,
    period,
    filters: base.filters,
  };

  console.info(`Traffic board row query started ${stringifyTrafficBoardLog(requestDebug)}`);

  if (!base.shouldFetchLiveData) {
    console.info(
      `Traffic board row query skipped ${stringifyTrafficBoardLog({
        ...requestDebug,
        reason: customer.status !== "正常" ? "inactive" : "no_domains",
        durationMs: Date.now() - startedAt,
      })}`,
    );

    return {
      row: base.baseRow,
      daysUntilRenewal: base.daysUntilRenewal,
    };
  }

  const {
    summaryResult,
    hasLiveData,
    trafficGb,
    trafficCost,
    trafficCostUsd,
    trafficCostCanRetry,
    trafficHint,
    canRetry,
  } = await buildTrafficBoardLiveSnapshot(customer, locale, base.filters);
  const selectedTrafficAvailable =
    shouldShowGiftTrafficProjection(period) &&
    (summaryResult.matchedDomainCount > 0 || summaryResult.failureReason === "empty");
  const selectedTrafficGb = hasLiveData ? trafficGb : 0;
  const currentWindowHours =
    base.windowElapsedDays && base.windowElapsedDays > 0 ? base.windowElapsedDays * 24 : null;
  const remainingWindowHours =
    base.windowElapsedDays &&
    base.windowTotalDays &&
    base.windowTotalDays > base.windowElapsedDays
      ? (base.windowTotalDays - base.windowElapsedDays) * 24
      : 0;
  let projectedPeriodTrafficGb: number | null = null;
  let projectedPeriodTrafficSource: "recent_72h" | "current_cycle_fallback" | "actual_only" | null = null;
  let projectedTrafficCost: string | null = null;
  const cycleWaiverTrafficFeeUsd = normalizeGiftCreditUsd(customer.monthlyGiftCreditUsd) ?? 0;
  const cycleOverspendUsd = Math.max(trafficCostUsd - cycleWaiverTrafficFeeUsd, 0);
  const cycleOverspend = formatUsd(cycleOverspendUsd, locale);
  const newCustomerGiftCreditUsd = normalizeGiftCreditUsd(customer.cumulativeGiftCreditUsd) ?? 0;
  const availableRechargeUsd =
    normalizeRechargeUsd(customer.availableRechargeUsd) ?? normalizeRechargeUsd(customer.cumulativeRechargeUsd) ?? 0;
  const cumulativeRechargeUsd = normalizeRechargeUsd(customer.cumulativeRechargeUsd) ?? 0;
  const remainingBalanceUsd = Number(Math.max(newCustomerGiftCreditUsd + cumulativeRechargeUsd - trafficCostUsd, 0).toFixed(2));
  const remainingBalance = formatUsd(remainingBalanceUsd, locale);
  const pendingTopUpUsd = Number(Math.max(cycleOverspendUsd - availableRechargeUsd, 0).toFixed(2));
  const pendingTopUp = formatUsd(pendingTopUpUsd, locale);

  if (shouldShowGiftTrafficProjection(period) && selectedTrafficAvailable && currentWindowHours) {
    if (remainingWindowHours <= 0) {
      projectedPeriodTrafficGb = selectedTrafficGb;
      projectedPeriodTrafficSource = "actual_only";
    } else {
      const recent72HoursWindow = buildRollingHoursTrafficFilters(72, now);
      const recent72HoursResult = isHardcodedMrsukanCutoverCustomer(customer)
        ? await buildHardcodedMrsukanTrafficSummary(customer, recent72HoursWindow.filters)
        : await buildAllDomainsTrafficSummary(customer.domains, recent72HoursWindow.filters);

      if (recent72HoursResult.matchedDomainCount > 0 || recent72HoursResult.failureReason === "empty") {
        const recent72HoursTrafficGb =
          recent72HoursResult.matchedDomainCount > 0
            ? applyTrafficMarkupToGb(recent72HoursResult.totalTrafficGb, customer.trafficMarkupPercent)
            : 0;
        const recent72HoursAverageGb = recent72HoursTrafficGb / recent72HoursWindow.elapsedHours;

        projectedPeriodTrafficGb = Number(
          (selectedTrafficGb + recent72HoursAverageGb * remainingWindowHours).toFixed(2),
        );
        projectedPeriodTrafficSource = "recent_72h";
      } else {
        const currentWindowAverageGb = selectedTrafficGb / currentWindowHours;

        projectedPeriodTrafficGb = Number(
          (selectedTrafficGb + currentWindowAverageGb * remainingWindowHours).toFixed(2),
        );
        projectedPeriodTrafficSource = "current_cycle_fallback";
      }
    }
  }

  if (projectedPeriodTrafficGb !== null && trafficGb > 0 && trafficCostUsd > 0) {
    projectedTrafficCost = formatUsd((trafficCostUsd / trafficGb) * projectedPeriodTrafficGb, locale);
  }

  console.info(
    `Traffic board row query finished ${stringifyTrafficBoardLog({
      ...requestDebug,
      hasLiveData,
      trafficGb,
      trafficCost,
      trafficCostUsd,
      trafficCostCanRetry,
      cycleOverspend,
      cycleOverspendUsd,
      traffic: hasLiveData ? formatTrafficFromGb(trafficGb, locale) : "--",
      matchedDomainCount: summaryResult.matchedDomainCount,
      failureReason: summaryResult.failureReason,
      trafficHint,
      selectedTrafficGb,
      currentWindowHours,
      remainingWindowHours,
      projectedPeriodTrafficGb,
      projectedPeriodTrafficSource,
      durationMs: Date.now() - startedAt,
    })}`,
  );

  return {
    row: {
      ...base.baseRow,
      traffic: hasLiveData ? formatTrafficFromGb(trafficGb, locale) : "--",
      hasLiveData,
      trafficGb,
      trafficCost,
      trafficCostUsd,
      trafficCostCanRetry,
      cycleOverspend,
      cycleOverspendUsd,
      newCustomerGiftCredit: customer.cumulativeGiftCreditUsd
        ? formatUsd(customer.cumulativeGiftCreditUsd, locale)
        : null,
      newCustomerGiftCreditUsd,
      availableRecharge: customer.availableRechargeUsd
        ? formatUsd(customer.availableRechargeUsd, locale)
        : customer.cumulativeRechargeUsd
          ? formatUsd(customer.cumulativeRechargeUsd, locale)
          : null,
      availableRechargeUsd,
      cumulativeRecharge: customer.cumulativeRechargeUsd
        ? formatUsd(customer.cumulativeRechargeUsd, locale)
        : null,
      cumulativeRechargeUsd,
      remainingBalance: hasLiveData ? remainingBalance : null,
      remainingBalanceUsd: hasLiveData ? remainingBalanceUsd : 0,
      pendingTopUp: hasLiveData ? pendingTopUp : null,
      pendingTopUpUsd: hasLiveData ? pendingTopUpUsd : 0,
      trafficHint,
      canRetry,
      projectedMonthTraffic: projectedPeriodTrafficGb ? formatTrafficFromGb(projectedPeriodTrafficGb, locale) : null,
      projectedTrafficCost,
    },
    daysUntilRenewal: base.daysUntilRenewal,
  };
}

export async function getTrafficBoardCycleHistory(
  locale: Locale,
  adminSession: AdminSession,
  customerId: string,
  now = new Date(),
): Promise<TrafficBoardCycleHistoryView | null> {
  const customerRecord = await getCustomerForAdmin(customerId, adminSession);

  if (!customerRecord) {
    return null;
  }

  const customer = toCustomerRecord(customerRecord);
  if ((customer.monthlyGiftCreditUsd ?? 0) <= 0) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      renewalDayDisplay: formatRenewalDayDisplay(customer.renewalDay, locale),
      trafficMarkupPercent: isSuperAdmin(adminSession) ? customer.trafficMarkupPercent : null,
      generatedAt: formatLocalDateTime(
        ...(() => {
          const parts = getDatePartsAtOffset(now, 8 * 60);
          return [parts.year, parts.month, parts.day, parts.hour, parts.minute] as const;
        })(),
      ),
      entries: [],
    };
  }

  const cycleWaiverTrafficFeeUsd = normalizeGiftCreditUsd(customer.monthlyGiftCreditUsd) ?? 0;
  const windows = buildCycleWaiverHistoryWindows(customer.renewalDay, locale, now);
  const entries: TrafficBoardCycleHistoryEntry[] = [];

  for (const window of windows) {
    const snapshot =
      customer.status === "正常" && customer.domains.length > 0
        ? await buildTrafficBoardLiveSnapshot(customer, locale, window.filters)
        : {
            summaryResult: {
              matchedDomainCount: 0,
              failureReason: customer.status !== "正常" ? "request_failed" : "domain_not_found",
            },
            hasLiveData: false,
            trafficGb: 0,
            trafficCost: null,
            trafficCostUsd: 0,
            trafficCostCanRetry: false,
            trafficHint:
              customer.status !== "正常"
                ? getTrafficBoardHint(locale, "inactive")
                : getTrafficBoardHint(locale, "no_domains"),
            canRetry: false,
          };
    const cycleOverspendUsd = Math.max(snapshot.trafficCostUsd - cycleWaiverTrafficFeeUsd, 0);

    entries.push({
      cycleRange: window.cycleRange,
      traffic: snapshot.hasLiveData ? formatTrafficFromGb(snapshot.trafficGb, locale) : "--",
      trafficGb: snapshot.trafficGb,
      trafficCost: snapshot.trafficCost,
      trafficCostUsd: snapshot.trafficCostUsd,
      cycleWaiverTrafficFee: cycleWaiverTrafficFeeUsd > 0 ? formatUsd(cycleWaiverTrafficFeeUsd, locale) : null,
      cycleWaiverTrafficFeeUsd,
      cycleOverspend: formatUsd(cycleOverspendUsd, locale),
      cycleOverspendUsd,
      reportHref: buildTrafficBoardReportHref(customer, "cycleWaiver", window.filters),
      hasLiveData: snapshot.hasLiveData,
      trafficHint: snapshot.trafficHint,
    });
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    renewalDayDisplay: formatRenewalDayDisplay(customer.renewalDay, locale),
    trafficMarkupPercent: isSuperAdmin(adminSession) ? customer.trafficMarkupPercent : null,
    generatedAt: formatLocalDateTime(
      ...(() => {
        const parts = getDatePartsAtOffset(now, 8 * 60);
        return [parts.year, parts.month, parts.day, parts.hour, parts.minute] as const;
      })(),
    ),
    entries,
  };
}

export async function getTrafficBoardShellView(
  locale: Locale,
  adminSession: AdminSession,
  period: TrafficBoardPeriod = "cycle",
  now = new Date(),
): Promise<TrafficBoardShellView> {
  const customers: CustomerRecord[] = (await getCustomersForAdmin(adminSession))
    .map(toCustomerRecord)
    .filter((customer) => shouldIncludeCustomerInTrafficBoardPeriod(customer, period));
  const rowsWithMeta = customers.map((customer) => buildTrafficBoardBaseRow(customer, locale, period, now));
  const generatedAt = formatLocalDateTime(
    ...(() => {
      const parts = getDatePartsAtOffset(now, 8 * 60);
      return [parts.year, parts.month, parts.day, parts.hour, parts.minute] as const;
    })(),
  );

  return {
    summary: {
      customerCount: rowsWithMeta.length,
      dueSoonCount: rowsWithMeta.filter((row) => row.daysUntilRenewal <= 3).length,
    },
    rows: rowsWithMeta.map((row) => sanitizeTrafficBoardRowForAdmin(row.baseRow, adminSession)),
    generatedAt,
    cycleHint: getTrafficBoardCycleHint(locale, period),
    period,
    trafficLabel: getTrafficMetricLabel(locale, period),
    trafficCostLabel: getTrafficCostMetricLabel(locale, period),
  };
}

export async function getTrafficBoardRow(
  locale: Locale,
  adminSession: AdminSession,
  customerId: string,
  period: TrafficBoardPeriod = "cycle",
  now = new Date(),
  traceId?: string,
): Promise<TrafficBoardRow | null> {
  const customer = await getCustomerForAdmin(customerId, adminSession);

  if (!customer) {
    return null;
  }

  return sanitizeTrafficBoardRowForAdmin(
    (await buildTrafficBoardRow(toCustomerRecord(customer), locale, period, now, traceId)).row,
    adminSession,
  );
}

export async function getTrafficBoardView(
  locale: Locale,
  adminSession: AdminSession,
  period: TrafficBoardPeriod = "cycle",
  now = new Date(),
): Promise<TrafficBoardView> {
  const customers: CustomerRecord[] = (await getCustomersForAdmin(adminSession))
    .map(toCustomerRecord)
    .filter((customer) => shouldIncludeCustomerInTrafficBoardPeriod(customer, period));

  const rows = await Promise.all(
    customers.map((customer) => buildTrafficBoardRow(customer, locale, period, now)),
  );

  const sortedRows = rows
    .sort((left, right) => {
      if (right.row.trafficGb !== left.row.trafficGb) {
        return right.row.trafficGb - left.row.trafficGb;
      }

      return left.row.customerName.localeCompare(right.row.customerName);
    })
    .map(({ row }) => row);
  const dueSoonCount = rows.filter((row) => row.daysUntilRenewal <= 3).length;
  const generatedAt = formatLocalDateTime(
    ...(() => {
      const parts = getDatePartsAtOffset(now, 8 * 60);
      return [parts.year, parts.month, parts.day, parts.hour, parts.minute] as const;
    })(),
  );

  return {
    metrics: buildTrafficBoardMetrics(locale, sortedRows, dueSoonCount, period),
    rows: sortedRows.map((row) => sanitizeTrafficBoardRowForAdmin(row, adminSession)),
    generatedAt,
    cycleHint: getTrafficBoardCycleHint(locale, period),
    period,
    trafficLabel: getTrafficMetricLabel(locale, period),
    trafficCostLabel: getTrafficCostMetricLabel(locale, period),
  };
}

export function getCustomers() {
  return prisma.customer.findMany({
    select: customerCoreSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export function getCustomersForAdmin(adminSession: AdminSession) {
  return prisma.customer.findMany({
    select: customerCoreSelect,
    where: isSuperAdmin(adminSession)
      ? undefined
      : {
          accountManagerEmail: adminSession.username,
        },
    orderBy: { updatedAt: "desc" },
  });
}

function formatAdminAccessLogDate(date: Date, locale: Locale) {
  return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function getCustomerForAdmin(id: string, adminSession: AdminSession) {
  return prisma.customer.findFirst({
    select: customerCoreSelect,
    where: isSuperAdmin(adminSession)
      ? { id }
      : {
          id,
          accountManagerEmail: adminSession.username,
        },
  });
}

export async function getCustomerByAuth(authCode?: string | null) {
  if (!authCode) {
    const firstCustomer = await prisma.customer.findFirst({
      select: customerCoreSelect,
      orderBy: { createdAt: "asc" },
    });

    return firstCustomer ? toCustomerRecord(firstCustomer) : null;
  }

  const customer = await prisma.customer.findUnique({
    select: customerCoreSelect,
    where: { authCode },
  });

  return customer ? toCustomerRecord(customer) : null;
}

export async function authenticateCustomer(authCode: string) {
  const customer = await getCustomerByAuth(authCode);

  if (!customer || customer.status !== "正常") {
    return null;
  }

  return customer;
}

export async function authenticateAdmin(username: string, password: string): Promise<AdminSession | null> {
  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin || admin.password !== password) {
    return null;
  }

  return {
    username: admin.username,
    displayName: admin.displayName,
    role: normalizeAdminRole(admin.role),
  };
}

export async function getAdminByUsername(username?: string | null): Promise<AdminSession | null> {
  if (!username) {
    return null;
  }

  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin) {
    return null;
  }

  return {
    username: admin.username,
    displayName: admin.displayName,
    role: normalizeAdminRole(admin.role),
  };
}

export async function getManagedAdminAccounts(
  adminSession: AdminSession,
  locale: Locale,
): Promise<ManagedAdminAccount[]> {
  assertSuperAdmin(adminSession);

  const [admins, customers] = await Promise.all([
    prisma.admin.findMany({
      orderBy: [{ role: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.customer.findMany({
      select: {
        accountManagerEmail: true,
      },
    }),
  ]);

  const customerCountMap: Record<string, number> = {};
  for (const customer of customers) {
    if (customer.accountManagerEmail) {
      customerCountMap[customer.accountManagerEmail] =
        (customerCountMap[customer.accountManagerEmail] ?? 0) + 1;
    }
  }

  return admins.map((admin: (typeof admins)[number], index: number) => ({
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    role: normalizeAdminRole(admin.role),
    assignedCustomerCount: customerCountMap[admin.username] ?? 0,
    updatedAt:
      locale === "en"
        ? index === 0
          ? "Just now"
          : `${index * 6} minutes ago`
        : index === 0
          ? "刚刚"
          : `${index * 6} 分钟前`,
  }));
}

export async function createAdminAccount(input: {
  adminSession: AdminSession;
  username: string;
  displayName: string;
  password: string;
  role: AdminRole;
}) {
  assertSuperAdmin(input.adminSession);

  const admin = await prisma.admin.create({
    data: {
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      password: input.password,
      role: input.role,
    },
  });

  return {
    username: admin.username,
    displayName: admin.displayName,
    role: normalizeAdminRole(admin.role),
  };
}

export async function updateAdminAccount(
  id: string,
  input: {
    adminSession: AdminSession;
    username: string;
    displayName: string;
    role: AdminRole;
    password?: string;
  },
) {
  assertSuperAdmin(input.adminSession);

  const existingAdmin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!existingAdmin) {
    throw new Error("ADMIN_NOT_FOUND");
  }

  const isCurrentAdmin = existingAdmin.username === input.adminSession.username;
  const nextUsername = isCurrentAdmin ? existingAdmin.username : input.username.trim();
  const nextRole = isCurrentAdmin ? normalizeAdminRole(existingAdmin.role) : input.role;

  const admin = await prisma.admin.update({
    where: { id },
    data: {
      username: nextUsername,
      displayName: input.displayName.trim(),
      role: nextRole,
      ...(input.password ? { password: input.password } : {}),
    },
  });

  if (existingAdmin.username !== nextUsername) {
    await prisma.customer.updateMany({
      where: {
        accountManagerEmail: existingAdmin.username,
      },
      data: {
        accountManagerEmail: nextUsername,
      },
    });
  }

  return {
    username: admin.username,
    displayName: admin.displayName,
    role: normalizeAdminRole(admin.role),
  };
}

export async function createCustomer(input: {
  adminSession: AdminSession;
  name: string;
  authCode: string;
  domains: string[];
  status: CustomerStatus;
  accountManagerEmail?: string | null;
  renewalDay?: number | null;
  monthlyGiftCreditUsd?: number | null;
  cumulativeGiftCreditUsd?: number | null;
  availableRechargeUsd?: number | null;
  cumulativeRechargeUsd?: number | null;
  trafficMarkupPercent?: number | null;
  notes?: string;
}) {
  const domains = normalizeDomains(input.domains);
  const accountManagerEmail = isSuperAdmin(input.adminSession)
    ? normalizeAccountManagerEmail(input.accountManagerEmail)
    : input.adminSession.username;
  const renewalDay = normalizeRenewalDay(input.renewalDay);
  const monthlyGiftCreditUsd = normalizeGiftCreditUsd(input.monthlyGiftCreditUsd);
  const cumulativeGiftCreditUsd = normalizeGiftCreditUsd(input.cumulativeGiftCreditUsd);
  const availableRechargeUsd =
    normalizeRechargeUsd(input.availableRechargeUsd) ?? normalizeRechargeUsd(input.cumulativeRechargeUsd);
  const cumulativeRechargeUsd = normalizeRechargeUsd(input.cumulativeRechargeUsd);
  const trafficMarkupPercent = isSuperAdmin(input.adminSession)
    ? normalizeTrafficMarkupPercent(input.trafficMarkupPercent)
    : null;
  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      authCode: input.authCode,
      domain: domains[0] ?? "",
      domainsJson: JSON.stringify(domains),
      status: input.status,
      timezone: "Asia/Shanghai",
      contact: "",
      notes: input.notes?.trim() || "暂无备注",
      accountManagerEmail,
      renewalDay,
      monthlyGiftCreditUsd,
      cumulativeGiftCreditUsd,
      availableRechargeUsd,
      cumulativeRechargeUsd,
      trafficMarkupPercent,
    },
  });

  return toCustomerRecord(customer);
}

export async function updateCustomer(
  id: string,
  input: {
    adminSession: AdminSession;
    name: string;
    authCode: string;
    domains: string[];
    status: CustomerStatus;
    accountManagerEmail?: string | null;
    renewalDay?: number | null;
    monthlyGiftCreditUsd?: number | null;
    cumulativeGiftCreditUsd?: number | null;
    availableRechargeUsd?: number | null;
    cumulativeRechargeUsd?: number | null;
    trafficMarkupPercent?: number | null;
    notes?: string;
  },
) {
  const existingCustomer = await getCustomerForAdmin(id, input.adminSession);
  if (!existingCustomer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const domains = normalizeDomains(input.domains);
  const accountManagerEmail = isSuperAdmin(input.adminSession)
    ? normalizeAccountManagerEmail(input.accountManagerEmail)
    : existingCustomer.accountManagerEmail ?? input.adminSession.username;
  const renewalDay = normalizeRenewalDay(input.renewalDay);
  const monthlyGiftCreditUsd = normalizeGiftCreditUsd(input.monthlyGiftCreditUsd);
  const cumulativeGiftCreditUsd = normalizeGiftCreditUsd(input.cumulativeGiftCreditUsd);
  const availableRechargeUsd =
    normalizeRechargeUsd(input.availableRechargeUsd) ?? normalizeRechargeUsd(existingCustomer.availableRechargeUsd);
  const cumulativeRechargeUsd = normalizeRechargeUsd(input.cumulativeRechargeUsd);
  const trafficMarkupPercent = isSuperAdmin(input.adminSession)
    ? normalizeTrafficMarkupPercent(input.trafficMarkupPercent)
    : normalizeTrafficMarkupPercent(existingCustomer.trafficMarkupPercent);
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: input.name,
      authCode: input.authCode,
      domain: domains[0] ?? "",
      domainsJson: JSON.stringify(domains),
      status: input.status,
      timezone: "Asia/Shanghai",
      contact: existingCustomer.contact,
      notes: input.notes?.trim() || "暂无备注",
      accountManagerEmail,
      renewalDay,
      monthlyGiftCreditUsd,
      cumulativeGiftCreditUsd,
      availableRechargeUsd,
      cumulativeRechargeUsd,
      trafficMarkupPercent,
    },
  });

  return toCustomerRecord(customer);
}

export async function deleteCustomer(id: string, adminSession: AdminSession) {
  const existingCustomer = await getCustomerForAdmin(id, adminSession);
  if (!existingCustomer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const customer = await prisma.customer.delete({
    where: { id },
  });

  return toCustomerRecord(customer);
}

export async function recordCustomerReportAccess(input: {
  customerId: string;
  ipAddress: string;
  userAgent?: string | null;
}) {
  const ipAddress = input.ipAddress.trim();
  if (!ipAddress) {
    return null;
  }

  return prisma.customerReportAccessLog.create({
    data: {
      customerId: input.customerId,
      ipAddress,
      userAgent: input.userAgent?.trim() || null,
    },
  });
}

export async function getCustomerReportAccessLogs(
  customerId: string,
  adminSession: AdminSession,
  locale: Locale,
): Promise<CustomerReportAccessLogRecord[]> {
  const customer = await getCustomerForAdmin(customerId, adminSession);
  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const logs = await prisma.customerReportAccessLog.findMany({
    where: { customerId },
    orderBy: { accessedAt: "desc" },
    take: 50,
  });

  if (logs.length > 0) {
    await prisma.customerReportAccessLog.updateMany({
      where: {
        customerId,
        viewedByAdminAt: null,
      },
      data: {
        viewedByAdminAt: new Date(),
      },
    });
  }

  return logs.map((log: (typeof logs)[number]) => ({
    id: log.id,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    accessedAt: formatAdminAccessLogDate(log.accessedAt, locale),
    viewedByAdmin: Boolean(log.viewedByAdminAt),
  }));
}

export async function getManagedAnnouncements(
  _adminSession: AdminSession,
): Promise<ManagedAnnouncement[]> {
  void _adminSession;

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  return announcements.map((announcement) => toManagedAnnouncement(announcement));
}

export async function createAnnouncement(input: {
  adminSession: AdminSession;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  startsAt?: string | null;
  endsAt?: string | null;
  enabled?: boolean;
}) {
  const titleZh = normalizeAnnouncementText(input.titleZh);
  const titleEn = normalizeAnnouncementText(input.titleEn);
  const contentZh = normalizeAnnouncementText(input.contentZh);
  const contentEn = normalizeAnnouncementText(input.contentEn);
  const startsAt = normalizeAnnouncementDateTime(input.startsAt);
  const endsAt = normalizeAnnouncementDateTime(input.endsAt);

  if (!titleZh || !titleEn || !contentZh || !contentEn) {
    throw new Error("ANNOUNCEMENT_REQUIRED_FIELDS");
  }

  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    throw new Error("ANNOUNCEMENT_INVALID_RANGE");
  }

  const announcement = await prisma.announcement.create({
    data: {
      titleZh,
      titleEn,
      contentZh,
      contentEn,
      startsAt,
      endsAt,
      enabled: input.enabled ?? true,
      createdByUsername: input.adminSession.username,
    },
  });

  return toManagedAnnouncement(announcement);
}

export async function updateAnnouncement(
  id: string,
  input: {
    adminSession: AdminSession;
    titleZh: string;
    titleEn: string;
    contentZh: string;
    contentEn: string;
    startsAt?: string | null;
    endsAt?: string | null;
    enabled?: boolean;
  },
) {
  const titleZh = normalizeAnnouncementText(input.titleZh);
  const titleEn = normalizeAnnouncementText(input.titleEn);
  const contentZh = normalizeAnnouncementText(input.contentZh);
  const contentEn = normalizeAnnouncementText(input.contentEn);
  const startsAt = normalizeAnnouncementDateTime(input.startsAt);
  const endsAt = normalizeAnnouncementDateTime(input.endsAt);

  if (!titleZh || !titleEn || !contentZh || !contentEn) {
    throw new Error("ANNOUNCEMENT_REQUIRED_FIELDS");
  }

  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    throw new Error("ANNOUNCEMENT_INVALID_RANGE");
  }

  const existingAnnouncement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existingAnnouncement) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      titleZh,
      titleEn,
      contentZh,
      contentEn,
      startsAt,
      endsAt,
      enabled: input.enabled ?? true,
    },
  });

  return toManagedAnnouncement(announcement);
}

export async function deleteAnnouncement(id: string, _adminSession: AdminSession) {
  void _adminSession;

  const existingAnnouncement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existingAnnouncement) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  const announcement = await prisma.announcement.delete({
    where: { id },
  });

  return toManagedAnnouncement(announcement);
}

export async function getClientAnnouncementView(
  ipAddress: string,
  now = new Date(),
): Promise<ClientAnnouncementView> {
  const normalizedIpAddress = ipAddress.trim();
  const announcements = await prisma.announcement.findMany({
    where: {
      enabled: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const activeAnnouncements = announcements.filter((announcement) => isAnnouncementActive(announcement, now));

  if (activeAnnouncements.length === 0) {
    return {
      announcements: [],
      initialAnnouncementId: null,
    };
  }

  let dismissedAnnouncementIds = new Set<string>();

  if (normalizedIpAddress) {
    const dismissals = await prisma.announcementDismissal.findMany({
      where: {
        ipAddress: normalizedIpAddress,
        announcementId: {
          in: activeAnnouncements.map((announcement) => announcement.id),
        },
      },
      select: {
        announcementId: true,
      },
    });

    dismissedAnnouncementIds = new Set(dismissals.map((item) => item.announcementId));
  }

  return {
    announcements: activeAnnouncements.map((announcement) => toClientAnnouncement(announcement)),
    initialAnnouncementId:
      activeAnnouncements.find((announcement) => !dismissedAnnouncementIds.has(announcement.id))?.id ?? null,
  };
}

export async function dismissAnnouncementForIp(input: {
  announcementId: string;
  ipAddress: string;
}) {
  const ipAddress = input.ipAddress.trim();
  if (!ipAddress) {
    return null;
  }

  const existingAnnouncement = await prisma.announcement.findUnique({
    where: { id: input.announcementId },
  });

  if (!existingAnnouncement) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  return prisma.announcementDismissal.upsert({
    where: {
      announcementId_ipAddress: {
        announcementId: input.announcementId,
        ipAddress,
      },
    },
    update: {
      dismissedAt: new Date(),
    },
    create: {
      announcementId: input.announcementId,
      ipAddress,
    },
  });
}

export async function getAdminView(locale: Locale, adminSession: AdminSession) {
  const rawCustomers = await getCustomersForAdmin(adminSession);
  const customers: CustomerRecord[] = rawCustomers.map(toCustomerRecord);
  const customerIds = customers.map((customer) => customer.id);
  const domainCount = customers.reduce((total, customer) => total + customer.domains.length, 0);
  let unreadLogGroups: Array<{ customerId: string; _count: { _all: number } }> = [];
  let latestLogs: Array<{ customerId: string; accessedAt: Date }> = [];
  let totalLogGroups: Array<{ customerId: string; _count: { _all: number } }> = [];

  if (customerIds.length > 0) {
    [unreadLogGroups, latestLogs, totalLogGroups] = await Promise.all([
      prisma.customerReportAccessLog.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          viewedByAdminAt: null,
        },
        _count: { _all: true },
      }),
      prisma.customerReportAccessLog.findMany({
        where: {
          customerId: { in: customerIds },
        },
        orderBy: [{ customerId: "asc" }, { accessedAt: "desc" }],
        distinct: ["customerId"],
        select: {
          customerId: true,
          accessedAt: true,
        },
      }),
      prisma.customerReportAccessLog.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
        },
        _count: { _all: true },
      }),
    ]);
  }
  const unreadLogCountMap = Object.fromEntries(
    unreadLogGroups.map((group) => [group.customerId, group._count._all]),
  );
  const totalLogCountMap = Object.fromEntries(
    totalLogGroups.map((group) => [group.customerId, group._count._all]),
  );
  const latestLogMap = Object.fromEntries(
    latestLogs.map((log) => [log.customerId, formatAdminAccessLogDate(log.accessedAt, locale)]),
  );

  return {
    metrics: [
      {
        label: locale === "en" ? "Total Customers" : "客户总数",
        value: String(customers.length),
        delta: locale === "en" ? "Live from database" : "实时读取数据库",
        tone: "brand" as const,
      },
      {
        label: locale === "en" ? "Active Domains" : "生效域名",
        value: String(domainCount),
        delta: locale === "en" ? "Multi-domain per customer" : "当前支持一客户多域名",
        tone: "success" as const,
      },
      {
        label: locale === "en" ? "Today's Traffic" : "今日总流量",
        value: "18.2 TB",
        delta: locale === "en" ? "Demo data, Alibaba Cloud later" : "演示数据，后续接阿里云",
        tone: "warning" as const,
      },
      {
        label: locale === "en" ? "Today's UV" : "今日总 UV",
        value: "482,390",
        delta: locale === "en" ? "Demo data, Alibaba Cloud later" : "演示数据，后续接阿里云",
        tone: "brand" as const,
      },
    ],
    trafficTrend: adminTrafficTrend,
    clientGrowth: adminTrafficTrend.map((point, index) => ({
      label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] ?? point.label,
      value: Math.max(customers.length - 1 + index, 1),
    })),
    activities: getAdminActivities(locale),
    customers: customers.map((customer, index): ManagedCustomerRecord => ({
      ...customer,
      updatedAt:
        locale === "en"
          ? index === 0
            ? "Just now"
            : `${index * 8} minutes ago`
          : index === 0
            ? "刚刚"
            : `${index * 8} 分钟前`,
      reportAccessUnreadCount: unreadLogCountMap[customer.id] ?? 0,
      reportAccessTotalCount: totalLogCountMap[customer.id] ?? 0,
      lastReportAccessAt: latestLogMap[customer.id] ?? null,
    })),
  };
}

const SHANGHAI_OFFSET_MINUTES = 8 * 60;
type PrismaTx = Prisma.TransactionClient;
type HardcodedDomainQuerySegment = {
  domain: string;
  filters: ReportFilters;
};

const MRSUKAN_REPORT_CUTOVER = {
  authCode: "69675488b693b936d0a409a0",
  legacyDomain: "rspn.sla.homes",
  nextDomain: "mrsukan.sla.homes",
  cutoverUtc: new Date(Date.UTC(2026, 5, 17, 16, 0, 0, 0)),
} as const;

function roundUsd(value: number) {
  return Number(value.toFixed(2));
}

function roundGb(value: number) {
  return Number(value.toFixed(2));
}

function getTotalBalanceUsd(input: {
  rechargeBalanceUsd: number;
  monthlyGiftBalanceUsd: number;
  cumulativeGiftBalanceUsd: number;
}) {
  return roundUsd(
    input.rechargeBalanceUsd + input.monthlyGiftBalanceUsd + input.cumulativeGiftBalanceUsd,
  );
}

function toLocalDayStartUtc(date: Date, offsetMinutes = SHANGHAI_OFFSET_MINUTES) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      0,
      0,
      0,
      0,
    ) -
      offsetMinutes * 60 * 1000,
  );
}

function getPreviousLocalDayRange(now: Date, offsetMinutes = SHANGHAI_OFFSET_MINUTES) {
  const currentDayStart = toLocalDayStartUtc(now, offsetMinutes);
  const previousDayStart = new Date(currentDayStart.getTime() - 24 * 60 * 60 * 1000);

  return {
    statementDate: previousDayStart,
    periodStartAt: previousDayStart,
    periodEndAt: currentDayStart,
  };
}

function buildDailySettlementFilters(): ReportFilters {
  return {
    queryType: "traffic",
    timeRange: "yesterday",
    area: "all",
    timeZone: "Asia/Shanghai",
    timeZoneOffsetMinutes: SHANGHAI_OFFSET_MINUTES,
    locations: [],
  };
}

function getCycleRangeForDate(date: Date, renewalDay: number | null, offsetMinutes = SHANGHAI_OFFSET_MINUTES) {
  const cycle = getCurrentBillingCycleMeta(renewalDay, "zh-CN", date, offsetMinutes);
  const cycleStartAt = new Date(cycle.cycleStartUtc);
  const cycleEndAt = new Date(cycle.cycleEndUtc);

  return { cycleStartAt, cycleEndAt };
}

function getReportTrafficGb(report: LiveDomainReportData) {
  return roundGb(report.trafficTrend.reduce((sum, point) => sum + point.value, 0));
}

function getStatementStatusFromReport(
  reportResult: Awaited<ReturnType<typeof buildAllDomainsTrafficReport>>,
  totalDomainCount: number,
): SettlementStatementStatus {
  if (
    (reportResult.report || reportResult.failureReason === "empty") &&
    reportResult.matchedDomainCount === totalDomainCount
  ) {
    return "settled";
  }

  if (reportResult.matchedDomainCount > 0) {
    return "partial";
  }

  return "failed";
}

async function ensureCustomerBalanceAccount(tx: PrismaTx, customerId: string) {
  return tx.customerBalanceAccount.upsert({
    where: { customerId },
    update: {},
    create: { customerId },
  });
}

async function createBalanceLedgerEntry(
  tx: PrismaTx,
  input: {
    accountId: string;
    customerId: string;
    entryType: SettlementLedgerEntryType;
    direction: "credit" | "debit";
    amountUsd: number;
    rechargeDeltaUsd?: number;
    monthlyGiftDeltaUsd?: number;
    cumulativeGiftDeltaUsd?: number;
    balanceAfterRechargeUsd: number;
    balanceAfterMonthlyGiftUsd: number;
    balanceAfterCumulativeGiftUsd: number;
    cycleStartAt?: Date | null;
    cycleEndAt?: Date | null;
    effectiveAt?: Date | null;
    note?: string;
    referenceType?: string;
    referenceId?: string;
    createdByUsername?: string | null;
  },
) {
  return tx.balanceLedgerEntry.create({
    data: {
      customerBalanceAccountId: input.accountId,
      customerId: input.customerId,
      entryType: input.entryType,
      direction: input.direction,
      amountUsd: roundUsd(input.amountUsd),
      rechargeDeltaUsd: roundUsd(input.rechargeDeltaUsd ?? 0),
      monthlyGiftDeltaUsd: roundUsd(input.monthlyGiftDeltaUsd ?? 0),
      cumulativeGiftDeltaUsd: roundUsd(input.cumulativeGiftDeltaUsd ?? 0),
      balanceAfterRechargeUsd: roundUsd(input.balanceAfterRechargeUsd),
      balanceAfterMonthlyGiftUsd: roundUsd(input.balanceAfterMonthlyGiftUsd),
      balanceAfterCumulativeGiftUsd: roundUsd(input.balanceAfterCumulativeGiftUsd),
      cycleStartAt: input.cycleStartAt ?? null,
      cycleEndAt: input.cycleEndAt ?? null,
      effectiveAt: input.effectiveAt ?? null,
      note: input.note ?? "",
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdByUsername: input.createdByUsername ?? null,
    },
  });
}

export async function createManualSettlementBalanceEntry(input: {
  adminSession: AdminSession;
  customerId: string;
  adjustmentType: SettlementAdjustmentType;
  amountUsd: number;
  note?: string;
}) {
  const customer = await getCustomerForAdmin(input.customerId, input.adminSession);
  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const amountUsd = roundUsd(input.amountUsd);
  if (amountUsd <= 0) {
    throw new Error("INVALID_SETTLEMENT_AMOUNT");
  }

  return prisma.$transaction(async (tx) => {
    const account = await ensureCustomerBalanceAccount(tx, customer.id);
    let rechargeBalanceUsd = roundUsd(account.rechargeBalanceUsd);
    let monthlyGiftBalanceUsd = roundUsd(account.monthlyGiftBalanceUsd);
    let cumulativeGiftBalanceUsd = roundUsd(account.cumulativeGiftBalanceUsd);
    let entryType: SettlementLedgerEntryType;
    let rechargeDeltaUsd = 0;

    if (input.adjustmentType === "recharge") {
      rechargeBalanceUsd = roundUsd(rechargeBalanceUsd + amountUsd);
      rechargeDeltaUsd = amountUsd;
      entryType = "manual_recharge";
    } else {
      if (amountUsd > rechargeBalanceUsd) {
        throw new Error("INSUFFICIENT_RECHARGE_BALANCE");
      }
      rechargeBalanceUsd = roundUsd(rechargeBalanceUsd - amountUsd);
      rechargeDeltaUsd = -amountUsd;
      entryType = "manual_writeoff";
    }

    await tx.customerBalanceAccount.update({
      where: { id: account.id },
      data: {
        rechargeBalanceUsd,
        monthlyGiftBalanceUsd,
        cumulativeGiftBalanceUsd,
      },
    });

    const ledgerEntry = await createBalanceLedgerEntry(tx, {
      accountId: account.id,
      customerId: customer.id,
      entryType,
      direction: input.adjustmentType === "recharge" ? "credit" : "debit",
      amountUsd,
      rechargeDeltaUsd,
      balanceAfterRechargeUsd: rechargeBalanceUsd,
      balanceAfterMonthlyGiftUsd: monthlyGiftBalanceUsd,
      balanceAfterCumulativeGiftUsd: cumulativeGiftBalanceUsd,
      note: input.note?.trim() || "",
      createdByUsername: input.adminSession.username,
      referenceType: "manual_settlement_adjustment",
    });

    return {
      customerId: customer.id,
      customerName: customer.name,
      ledgerEntryId: ledgerEntry.id,
      entryType,
      amountUsd,
      rechargeBalanceUsd,
      monthlyGiftBalanceUsd,
      cumulativeGiftBalanceUsd,
      totalBalanceUsd: getTotalBalanceUsd({
        rechargeBalanceUsd,
        monthlyGiftBalanceUsd,
        cumulativeGiftBalanceUsd,
      }),
    };
  });
}

export async function getSettlementCenterView(
  locale: Locale,
  adminSession: AdminSession,
): Promise<SettlementCenterView> {
  const customers = (await getCustomersForAdmin(adminSession)).map(toCustomerRecord);
  if (customers.length === 0) {
    return {
      totalCustomers: 0,
      totalBalanceUsd: 0,
      settledYesterdayCount: 0,
      pendingStatementCount: 0,
      customers: [],
      recentStatements: [],
      recentLedgerEntries: [],
    };
  }

  const customerIds = customers.map((customer) => customer.id);
  const yesterdayStatementDate = getPreviousLocalDayRange(new Date()).statementDate;
  const [accounts, yesterdayStatements, recentStatements, recentLedgerEntries] = await Promise.all([
    prisma.customerBalanceAccount.findMany({
      where: { customerId: { in: customerIds } },
    }),
    prisma.billingStatement.findMany({
      where: {
        customerId: { in: customerIds },
        statementType: "daily_charge",
        statementDate: yesterdayStatementDate,
      },
      orderBy: [{ customerId: "asc" }, { updatedAt: "desc" }],
      distinct: ["customerId"],
    }),
    prisma.billingStatement.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: [{ statementDate: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.balanceLedgerEntry.findMany({
      where: {
        customerId: { in: customerIds },
        entryType: {
          in: ["manual_recharge", "manual_writeoff"],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
    }),
  ]);

  const accountMap = new Map(accounts.map((account) => [account.customerId, account]));
  const yesterdayStatementMap = new Map(
    yesterdayStatements.map((statement) => [statement.customerId, statement]),
  );
  const customerNameMap = new Map(customers.map((customer) => [customer.id, customer.name]));

  function toSettlementStatementRow(statement: (typeof recentStatements)[number]): SettlementStatementRow {
    return {
      id: statement.id,
      customerId: statement.customerId,
      customerName: customerNameMap.get(statement.customerId) ?? statement.customerId,
      statementDate: formatAdminAccessLogDate(statement.statementDate, locale),
      statementType: statement.statementType as SettlementStatementType,
      trafficCostUsd: roundUsd(statement.trafficCostUsd),
      deductedUsd: roundUsd(
        statement.monthlyGiftDeductedUsd +
          statement.cumulativeGiftDeductedUsd +
          statement.rechargeDeductedUsd,
      ),
      remainingAmountUsd: roundUsd(statement.remainingAmountUsd),
      status: statement.status as SettlementStatementStatus,
      updatedAt: formatAdminAccessLogDate(statement.updatedAt, locale),
    };
  }

  function toSettlementLedgerEntryRow(
    entry: (typeof recentLedgerEntries)[number],
  ): SettlementLedgerEntryRow {
    return {
      id: entry.id,
      customerId: entry.customerId,
      customerName: customerNameMap.get(entry.customerId) ?? entry.customerId,
      entryType: entry.entryType as SettlementLedgerEntryType,
      direction: entry.direction as "credit" | "debit",
      amountUsd: roundUsd(entry.amountUsd),
      balanceAfterTotalUsd: getTotalBalanceUsd({
        rechargeBalanceUsd: entry.balanceAfterRechargeUsd,
        monthlyGiftBalanceUsd: entry.balanceAfterMonthlyGiftUsd,
        cumulativeGiftBalanceUsd: entry.balanceAfterCumulativeGiftUsd,
      }),
      note: entry.note,
      createdByUsername: entry.createdByUsername,
      createdAt: formatAdminAccessLogDate(entry.createdAt, locale),
    };
  }

  return {
    totalCustomers: customers.length,
    totalBalanceUsd: roundUsd(
      accounts.reduce(
        (sum, account) =>
          sum +
          getTotalBalanceUsd({
            rechargeBalanceUsd: account.rechargeBalanceUsd,
            monthlyGiftBalanceUsd: account.monthlyGiftBalanceUsd,
            cumulativeGiftBalanceUsd: account.cumulativeGiftBalanceUsd,
          }),
        0,
      ),
    ),
    settledYesterdayCount: yesterdayStatements.filter((statement) => statement.status === "settled")
      .length,
    pendingStatementCount: yesterdayStatements.filter((statement) => statement.status !== "settled")
      .length,
    customers: customers.map((customer) => {
      const account = accountMap.get(customer.id);
      const yesterdayStatement = yesterdayStatementMap.get(customer.id);
      const rechargeBalanceUsd = roundUsd(account?.rechargeBalanceUsd ?? 0);
      const monthlyGiftBalanceUsd = roundUsd(account?.monthlyGiftBalanceUsd ?? 0);
      const cumulativeGiftBalanceUsd = roundUsd(account?.cumulativeGiftBalanceUsd ?? 0);

      return {
        customerId: customer.id,
        customerName: customer.name,
        rechargeBalanceUsd,
        monthlyGiftBalanceUsd,
        cumulativeGiftBalanceUsd,
        totalBalanceUsd: getTotalBalanceUsd({
          rechargeBalanceUsd,
          monthlyGiftBalanceUsd,
          cumulativeGiftBalanceUsd,
        }),
        yesterdayStatus:
          (yesterdayStatement?.status as SettlementStatementStatus | undefined) ?? "pending",
        lastUpdatedAt: account?.updatedAt ? formatAdminAccessLogDate(account.updatedAt, locale) : null,
      };
    }),
    recentStatements: recentStatements.map(toSettlementStatementRow),
    recentLedgerEntries: recentLedgerEntries.map(toSettlementLedgerEntryRow),
  };
}

export async function getSettlementCustomerDetailView(
  locale: Locale,
  adminSession: AdminSession,
  customerId: string,
): Promise<SettlementCustomerDetailView | null> {
  const customer = await getCustomerForAdmin(customerId, adminSession);
  if (!customer) {
    return null;
  }

  const [account, ledgerEntries, statements] = await Promise.all([
    prisma.customerBalanceAccount.findUnique({
      where: { customerId: customer.id },
    }),
    prisma.balanceLedgerEntry.findMany({
      where: { customerId: customer.id },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.billingStatement.findMany({
      where: { customerId: customer.id },
      orderBy: [{ statementDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const rechargeBalanceUsd = roundUsd(account?.rechargeBalanceUsd ?? 0);
  const monthlyGiftBalanceUsd = roundUsd(account?.monthlyGiftBalanceUsd ?? 0);
  const cumulativeGiftBalanceUsd = roundUsd(account?.cumulativeGiftBalanceUsd ?? 0);

  return {
    customerId: customer.id,
    customerName: customer.name,
    rechargeBalanceUsd,
    monthlyGiftBalanceUsd,
    cumulativeGiftBalanceUsd,
    totalBalanceUsd: getTotalBalanceUsd({
      rechargeBalanceUsd,
      monthlyGiftBalanceUsd,
      cumulativeGiftBalanceUsd,
    }),
    lastUpdatedAt: account?.updatedAt ? formatAdminAccessLogDate(account.updatedAt, locale) : null,
    lastSnapshotAt: account?.lastSnapshotAt ? formatAdminAccessLogDate(account.lastSnapshotAt, locale) : null,
    lastSettledAt: account?.lastSettledAt ? formatAdminAccessLogDate(account.lastSettledAt, locale) : null,
    ledgerEntries: ledgerEntries.map((entry) => ({
      id: entry.id,
      customerId: entry.customerId,
      customerName: customer.name,
      entryType: entry.entryType as SettlementLedgerEntryType,
      direction: entry.direction as "credit" | "debit",
      amountUsd: roundUsd(entry.amountUsd),
      balanceAfterTotalUsd: getTotalBalanceUsd({
        rechargeBalanceUsd: entry.balanceAfterRechargeUsd,
        monthlyGiftBalanceUsd: entry.balanceAfterMonthlyGiftUsd,
        cumulativeGiftBalanceUsd: entry.balanceAfterCumulativeGiftUsd,
      }),
      note: entry.note,
      createdByUsername: entry.createdByUsername,
      createdAt: formatAdminAccessLogDate(entry.createdAt, locale),
    })),
    statements: statements.map((statement) => ({
      id: statement.id,
      customerId: statement.customerId,
      customerName: customer.name,
      statementDate: formatAdminAccessLogDate(statement.statementDate, locale),
      statementType: statement.statementType as SettlementStatementType,
      trafficCostUsd: roundUsd(statement.trafficCostUsd),
      deductedUsd: roundUsd(
        statement.monthlyGiftDeductedUsd +
          statement.cumulativeGiftDeductedUsd +
          statement.rechargeDeductedUsd,
      ),
      remainingAmountUsd: roundUsd(statement.remainingAmountUsd),
      status: statement.status as SettlementStatementStatus,
      updatedAt: formatAdminAccessLogDate(statement.updatedAt, locale),
    })),
  };
}

export async function runDailySettlementJob(now = new Date()) {
  const customers = (await prisma.customer.findMany({
    where: {
      status: "正常",
    },
    orderBy: { updatedAt: "desc" },
  })).map(toCustomerRecord).filter((customer) => customer.domains.length > 0);

  const dailyWindow = getPreviousLocalDayRange(now);
  const filters = buildDailySettlementFilters();
  let settledCount = 0;
  let partialCount = 0;
  let failedCount = 0;

  for (const customer of customers) {
    const reportResult = await buildAllDomainsTrafficReport(customer.domains, filters, "zh-CN");
    const status = getStatementStatusFromReport(reportResult, customer.domains.length);
    const reportTrafficGb = reportResult.report
      ? applyTrafficMarkupToGb(getReportTrafficGb(reportResult.report), customer.trafficMarkupPercent)
      : 0;
    const reportCostUsd = reportResult.report
      ? applyTrafficMarkupToUsd(parseUsd(reportResult.report.regionalTrafficTotalCost), customer.trafficMarkupPercent)
      : 0;
    const failureReason =
      status === "settled" ? null : reportResult.failureReason ?? "request_failed";
    const detailsJson = stringifyTrafficBoardLog({
      customerId: customer.id,
      customerName: customer.name,
      domains: customer.domains,
      matchedDomainCount: reportResult.matchedDomainCount,
      totalDomainCount: customer.domains.length,
      failureReason,
    });

    await prisma.$transaction(async (tx) => {
      const account = await ensureCustomerBalanceAccount(tx, customer.id);
      await tx.customerDailySettlementSnapshot.upsert({
        where: {
          customerId_snapshotDate: {
            customerId: customer.id,
            snapshotDate: dailyWindow.statementDate,
          },
        },
        update: {
          periodStartAt: dailyWindow.periodStartAt,
          periodEndAt: dailyWindow.periodEndAt,
          totalTrafficGb: reportTrafficGb,
          totalCostUsd: reportCostUsd,
          matchedDomainCount: reportResult.matchedDomainCount,
          totalDomainCount: customer.domains.length,
          status,
          failureReason,
          detailsJson,
        },
        create: {
          customerBalanceAccountId: account.id,
          customerId: customer.id,
          snapshotDate: dailyWindow.statementDate,
          periodStartAt: dailyWindow.periodStartAt,
          periodEndAt: dailyWindow.periodEndAt,
          totalTrafficGb: reportTrafficGb,
          totalCostUsd: reportCostUsd,
          matchedDomainCount: reportResult.matchedDomainCount,
          totalDomainCount: customer.domains.length,
          status,
          failureReason,
          detailsJson,
        },
      });

      if (status !== "settled") {
        await tx.customerBalanceAccount.update({
          where: { id: account.id },
          data: {
            lastSnapshotAt: now,
          },
        });

        await tx.billingStatement.upsert({
          where: {
            customerId_statementType_statementDate: {
              customerId: customer.id,
              statementType: "daily_charge",
              statementDate: dailyWindow.statementDate,
            },
          },
          update: {
            periodStartAt: dailyWindow.periodStartAt,
            periodEndAt: dailyWindow.periodEndAt,
            totalTrafficGb: reportTrafficGb,
            trafficCostUsd: reportCostUsd,
            matchedDomainCount: reportResult.matchedDomainCount,
            totalDomainCount: customer.domains.length,
            status,
            failureReason,
            summaryJson: detailsJson,
            note:
              status === "partial"
                ? "Not all domains returned billable data. Auto deduction is skipped."
                : "Alibaba Cloud data is unavailable for this T+1 run. Auto deduction is skipped.",
            settledAt: null,
          },
          create: {
            customerBalanceAccountId: account.id,
            customerId: customer.id,
            statementType: "daily_charge",
            statementDate: dailyWindow.statementDate,
            periodStartAt: dailyWindow.periodStartAt,
            periodEndAt: dailyWindow.periodEndAt,
            totalTrafficGb: reportTrafficGb,
            trafficCostUsd: reportCostUsd,
            matchedDomainCount: reportResult.matchedDomainCount,
            totalDomainCount: customer.domains.length,
            status,
            failureReason,
            summaryJson: detailsJson,
            note:
              status === "partial"
                ? "Not all domains returned billable data. Auto deduction is skipped."
                : "Alibaba Cloud data is unavailable for this T+1 run. Auto deduction is skipped.",
          },
        });
        return;
      }

      const existingStatement = await tx.billingStatement.findUnique({
        where: {
          customerId_statementType_statementDate: {
            customerId: customer.id,
            statementType: "daily_charge",
            statementDate: dailyWindow.statementDate,
          },
        },
      });

      if (existingStatement?.status === "settled") {
        await tx.customerBalanceAccount.update({
          where: { id: account.id },
          data: {
            lastSnapshotAt: now,
          },
        });
        return;
      }

      const { cycleStartAt, cycleEndAt } = getCycleRangeForDate(dailyWindow.periodEndAt, customer.renewalDay);
      let rechargeBalanceUsd = roundUsd(account.rechargeBalanceUsd);
      let monthlyGiftBalanceUsd = roundUsd(account.monthlyGiftBalanceUsd);
      let cumulativeGiftBalanceUsd = roundUsd(account.cumulativeGiftBalanceUsd);

      const existingMonthlyGrant = await tx.balanceLedgerEntry.findFirst({
        where: {
          customerId: customer.id,
          entryType: "monthly_gift_grant",
          cycleStartAt,
        },
      });
      if (!existingMonthlyGrant && customer.monthlyGiftCreditUsd) {
        monthlyGiftBalanceUsd = roundUsd(monthlyGiftBalanceUsd + customer.monthlyGiftCreditUsd);
        await createBalanceLedgerEntry(tx, {
          accountId: account.id,
          customerId: customer.id,
          entryType: "monthly_gift_grant",
          direction: "credit",
          amountUsd: customer.monthlyGiftCreditUsd,
          monthlyGiftDeltaUsd: customer.monthlyGiftCreditUsd,
          balanceAfterRechargeUsd: rechargeBalanceUsd,
          balanceAfterMonthlyGiftUsd: monthlyGiftBalanceUsd,
          balanceAfterCumulativeGiftUsd: cumulativeGiftBalanceUsd,
          cycleStartAt,
          cycleEndAt,
          effectiveAt: cycleStartAt,
          note: "Auto grant at billing cycle start based on the customer's cycle gift credit setting.",
          referenceType: "customer_cycle",
        });
      }

      const existingCumulativeGrant = await tx.balanceLedgerEntry.findFirst({
        where: {
          customerId: customer.id,
          entryType: "cumulative_gift_grant",
          referenceType: "customer_config",
        },
      });
      if (!existingCumulativeGrant && customer.cumulativeGiftCreditUsd) {
        cumulativeGiftBalanceUsd = roundUsd(
          cumulativeGiftBalanceUsd + customer.cumulativeGiftCreditUsd,
        );
        await createBalanceLedgerEntry(tx, {
          accountId: account.id,
          customerId: customer.id,
          entryType: "cumulative_gift_grant",
          direction: "credit",
          amountUsd: customer.cumulativeGiftCreditUsd,
          cumulativeGiftDeltaUsd: customer.cumulativeGiftCreditUsd,
          balanceAfterRechargeUsd: rechargeBalanceUsd,
          balanceAfterMonthlyGiftUsd: monthlyGiftBalanceUsd,
          balanceAfterCumulativeGiftUsd: cumulativeGiftBalanceUsd,
          effectiveAt: cycleStartAt,
          note: "Initial cumulative gift credit from customer configuration.",
          referenceType: "customer_config",
        });
      }

      let remainingAmountUsd = roundUsd(reportCostUsd);
      const monthlyGiftDeductedUsd = roundUsd(Math.min(monthlyGiftBalanceUsd, remainingAmountUsd));
      monthlyGiftBalanceUsd = roundUsd(monthlyGiftBalanceUsd - monthlyGiftDeductedUsd);
      remainingAmountUsd = roundUsd(remainingAmountUsd - monthlyGiftDeductedUsd);

      const cumulativeGiftDeductedUsd = roundUsd(
        Math.min(cumulativeGiftBalanceUsd, remainingAmountUsd),
      );
      cumulativeGiftBalanceUsd = roundUsd(cumulativeGiftBalanceUsd - cumulativeGiftDeductedUsd);
      remainingAmountUsd = roundUsd(remainingAmountUsd - cumulativeGiftDeductedUsd);

      const rechargeDeductedUsd = roundUsd(Math.min(rechargeBalanceUsd, remainingAmountUsd));
      rechargeBalanceUsd = roundUsd(rechargeBalanceUsd - rechargeDeductedUsd);
      remainingAmountUsd = roundUsd(remainingAmountUsd - rechargeDeductedUsd);

      const statement = await tx.billingStatement.upsert({
        where: {
          customerId_statementType_statementDate: {
            customerId: customer.id,
            statementType: "daily_charge",
            statementDate: dailyWindow.statementDate,
          },
        },
        update: {
          cycleStartAt,
          cycleEndAt,
          periodStartAt: dailyWindow.periodStartAt,
          periodEndAt: dailyWindow.periodEndAt,
          totalTrafficGb: reportTrafficGb,
          trafficCostUsd: reportCostUsd,
          monthlyGiftDeductedUsd,
          cumulativeGiftDeductedUsd,
          rechargeDeductedUsd,
          remainingAmountUsd,
          matchedDomainCount: reportResult.matchedDomainCount,
          totalDomainCount: customer.domains.length,
          status: "settled",
          failureReason: null,
          summaryJson: detailsJson,
          note: remainingAmountUsd > 0 ? "Insufficient balance after automatic deduction." : "",
          settledAt: now,
        },
        create: {
          customerBalanceAccountId: account.id,
          customerId: customer.id,
          statementType: "daily_charge",
          statementDate: dailyWindow.statementDate,
          cycleStartAt,
          cycleEndAt,
          periodStartAt: dailyWindow.periodStartAt,
          periodEndAt: dailyWindow.periodEndAt,
          totalTrafficGb: reportTrafficGb,
          trafficCostUsd: reportCostUsd,
          monthlyGiftDeductedUsd,
          cumulativeGiftDeductedUsd,
          rechargeDeductedUsd,
          remainingAmountUsd,
          matchedDomainCount: reportResult.matchedDomainCount,
          totalDomainCount: customer.domains.length,
          status: "settled",
          failureReason: null,
          summaryJson: detailsJson,
          note: remainingAmountUsd > 0 ? "Insufficient balance after automatic deduction." : "",
          settledAt: now,
        },
      });

      await tx.customerBalanceAccount.update({
        where: { id: account.id },
        data: {
          rechargeBalanceUsd,
          monthlyGiftBalanceUsd,
          cumulativeGiftBalanceUsd,
          lastSnapshotAt: now,
          lastSettledAt: now,
        },
      });

      await createBalanceLedgerEntry(tx, {
        accountId: account.id,
        customerId: customer.id,
        entryType: "traffic_charge",
        direction: "debit",
        amountUsd: monthlyGiftDeductedUsd + cumulativeGiftDeductedUsd + rechargeDeductedUsd,
        rechargeDeltaUsd: rechargeDeductedUsd > 0 ? -rechargeDeductedUsd : 0,
        monthlyGiftDeltaUsd: monthlyGiftDeductedUsd > 0 ? -monthlyGiftDeductedUsd : 0,
        cumulativeGiftDeltaUsd: cumulativeGiftDeductedUsd > 0 ? -cumulativeGiftDeductedUsd : 0,
        balanceAfterRechargeUsd: rechargeBalanceUsd,
        balanceAfterMonthlyGiftUsd: monthlyGiftBalanceUsd,
        balanceAfterCumulativeGiftUsd: cumulativeGiftBalanceUsd,
        cycleStartAt,
        cycleEndAt,
        effectiveAt: dailyWindow.periodEndAt,
        note:
          remainingAmountUsd > 0
            ? `Daily traffic charge settled with outstanding ${remainingAmountUsd.toFixed(2)} USD.`
            : "Daily traffic charge settled automatically.",
        referenceType: "billing_statement",
        referenceId: statement.id,
      });
    });

    if (status === "settled") {
      settledCount += 1;
    } else if (status === "partial") {
      partialCount += 1;
    } else {
      failedCount += 1;
    }
  }

  return {
    statementDate: dailyWindow.statementDate.toISOString(),
    totalCustomers: customers.length,
    settledCount,
    partialCount,
    failedCount,
  };
}

export async function getAdminReportRecords(
  locale: Locale,
  adminSession: AdminSession,
): Promise<AdminReportRecord[]> {
  return getAdminReportRecordsWithFilters(locale, adminSession, defaultReportFilters);
}

export async function getAdminReportRecordsWithFilters(
  locale: Locale,
  adminSession: AdminSession,
  filters: ReportFilters = defaultReportFilters,
): Promise<AdminReportRecord[]> {
  try {
    const customers: CustomerRecord[] = (await getCustomersForAdmin(adminSession)).map(toCustomerRecord);
    if (customers.length === 0) {
      return [];
    }
    const queryType = filters.queryType ?? "traffic";
    const selectedCustomer =
      customers.find((customer) => customer.id === filters.customerId) ?? customers[0];
    const shouldDefaultToAllDomains =
      queryType === "traffic" && !filters.domain && (selectedCustomer?.domains.length ?? 0) > 1;
    const shouldAggregateAllDomains =
      queryType === "traffic" &&
      (filters.domain === ALL_CLIENT_DOMAINS || shouldDefaultToAllDomains);
    const effectiveFilters = selectedCustomer
      ? normalizeBillingCycleReportFilters(filters, selectedCustomer.renewalDay)
      : filters;
    const selectedDomain = shouldAggregateAllDomains
      ? ALL_CLIENT_DOMAINS
      : selectedCustomer?.domains.find((domain) => domain === filters.domain) ??
        selectedCustomer?.domains[0];
    let allDomainsReportResult: Awaited<ReturnType<typeof buildAllDomainsTrafficReport>> | null = null;
    let liveReportResult: Awaited<ReturnType<typeof fetchLiveDomainReport>> | null = null;

    if (selectedCustomer && selectedDomain) {
      try {
        if (isHardcodedMrsukanCutoverCustomer(selectedCustomer)) {
          const hardcodedReportResult = await buildHardcodedMrsukanReport(
            selectedCustomer,
            effectiveFilters,
            locale,
            selectedDomain === ALL_CLIENT_DOMAINS ? null : selectedDomain,
          );
          liveReportResult = hardcodedReportResult.data;
        } else {
          allDomainsReportResult =
            selectedDomain === ALL_CLIENT_DOMAINS
              ? await buildAllDomainsTrafficReport(selectedCustomer.domains, effectiveFilters, locale)
              : null;
          liveReportResult =
            selectedDomain === ALL_CLIENT_DOMAINS
              ? allDomainsReportResult?.report ?? null
              : (await buildSegmentedLiveDomainReport(selectedDomain, effectiveFilters, locale)).data;
        }
      } catch (error) {
        console.error("Failed to load live admin report", {
          customerId: selectedCustomer.id,
          domain: selectedDomain,
          filters: effectiveFilters,
          error,
        });
        allDomainsReportResult = null;
        liveReportResult = null;
      }
    }
    const reportNotice =
      selectedDomain === ALL_CLIENT_DOMAINS &&
      selectedCustomer &&
      allDomainsReportResult &&
      allDomainsReportResult.failureReason &&
      allDomainsReportResult.failureReason !== "empty"
        ? getAllDomainsIncompleteNotice(
            locale,
            allDomainsReportResult.matchedDomainCount,
            selectedCustomer.domains.length,
          )
        : null;
    const liveReport =
      selectedCustomer && liveReportResult
        ? applyTrafficMarkupToLiveReportData(
            liveReportResult,
            selectedCustomer.trafficMarkupPercent,
            locale,
          )
        : liveReportResult;
    const unavailableReport = buildUnavailableReport(locale);

    return customers.flatMap((customer) =>
      [
        ...(queryType === "traffic" && customer.domains.length > 1 ? [ALL_CLIENT_DOMAINS] : []),
        ...customer.domains,
      ].map((domain) => {
        const domainLabel =
          domain === ALL_CLIENT_DOMAINS
            ? locale === "en"
              ? "All Domains"
              : "全域名"
            : domain;
        const baseRecord = {
          customerId: customer.id,
          customerName: customer.name,
          domain,
          status: customer.status,
          customer,
          reportNotice: null,
          metrics: unavailableReport.metrics,
          pvUvTrend: unavailableReport.pvUvTrend,
          trafficTrend: unavailableReport.trafficTrend,
          peakBandwidth: unavailableReport.peakBandwidth,
          highlights: buildHighlights(customer, locale, domainLabel),
          trafficUsageTable: unavailableReport.trafficUsageTable,
          audienceUsageTable: unavailableReport.audienceUsageTable,
          regionalTrafficTable: unavailableReport.regionalTrafficTable,
          regionalTrafficTotalCost: unavailableReport.regionalTrafficTotalCost,
        };

        if (
          liveReport &&
          selectedCustomer &&
          customer.id === selectedCustomer.id &&
          domain === selectedDomain
        ) {
          return {
            ...baseRecord,
            reportNotice,
            metrics: liveReport.metrics,
            pvUvTrend: liveReport.pvUvTrend,
            trafficTrend: liveReport.trafficTrend,
            peakBandwidth: liveReport.peakBandwidth,
            trafficUsageTable: liveReport.trafficUsageTable,
            audienceUsageTable: liveReport.audienceUsageTable,
            regionalTrafficTable: liveReport.regionalTrafficTable,
            regionalTrafficTotalCost: liveReport.regionalTrafficTotalCost,
          };
        }

        return baseRecord;
      }),
    );
  } catch (error) {
    console.error("Failed to load admin report records", {
      admin: adminSession.username,
      filters,
      error,
    });
    return [];
  }
}

export async function getClientDashboard(
  authCode?: string | null,
  locale: Locale = "zh-CN",
  requestedDomain?: string | null,
  filters: ReportFilters = defaultReportFilters,
): Promise<ClientDashboard | null> {
  const customer = await getCustomerByAuth(authCode);

  if (!customer || customer.status !== "正常") {
    return null;
  }

  const queryType = filters.queryType ?? "traffic";
  const shouldDefaultToAllDomains =
    queryType === "traffic" && !requestedDomain && customer.domains.length > 1;
  const shouldAggregateAllDomains =
    queryType === "traffic" &&
    (requestedDomain === ALL_CLIENT_DOMAINS || shouldDefaultToAllDomains);
  const effectiveFilters = normalizeClientReportFilters(
    normalizeBillingCycleReportFilters(filters, customer.renewalDay),
  );
  const selectedDomain = shouldAggregateAllDomains
    ? ALL_CLIENT_DOMAINS
    : customer.domains.find((domain) => domain === requestedDomain) ?? customer.domains[0];

  if (!selectedDomain) {
    return null;
  }

  const allDomainsReportResult = shouldAggregateAllDomains
    ? isHardcodedMrsukanCutoverCustomer(customer)
      ? null
      : await buildAllDomainsTrafficReport(customer.domains, effectiveFilters, locale)
    : null;
  const liveReport =
    isHardcodedMrsukanCutoverCustomer(customer)
      ? (
          await buildHardcodedMrsukanReport(
            customer,
            effectiveFilters,
            locale,
            shouldAggregateAllDomains ? null : selectedDomain,
          )
        ).data
      : shouldAggregateAllDomains
        ? allDomainsReportResult?.report ?? null
        : (await buildSegmentedLiveDomainReport(selectedDomain, effectiveFilters, locale)).data;
  const adjustedLiveReport = liveReport
    ? applyTrafficMarkupToLiveReportData(liveReport, customer.trafficMarkupPercent, locale)
    : liveReport;
  const unavailableReport = buildUnavailableReport(locale);
  const selectedDomainLabel =
    selectedDomain === ALL_CLIENT_DOMAINS
      ? locale === "en"
        ? "All Domains"
        : "全域名"
      : selectedDomain;

  return {
    customer,
    selectedDomain,
    availableDomains: customer.domains,
    reportNotice:
      shouldAggregateAllDomains &&
      allDomainsReportResult &&
      allDomainsReportResult.failureReason &&
      allDomainsReportResult.failureReason !== "empty"
        ? getAllDomainsIncompleteNotice(
            locale,
            allDomainsReportResult.matchedDomainCount,
            customer.domains.length,
          )
        : null,
    metrics: adjustedLiveReport?.metrics ?? unavailableReport.metrics,
    pvUvTrend: adjustedLiveReport?.pvUvTrend ?? unavailableReport.pvUvTrend,
    trafficTrend: adjustedLiveReport?.trafficTrend ?? unavailableReport.trafficTrend,
    peakBandwidth: adjustedLiveReport?.peakBandwidth ?? unavailableReport.peakBandwidth,
    highlights: buildHighlights(customer, locale, selectedDomainLabel),
    trafficUsageTable: adjustedLiveReport?.trafficUsageTable ?? unavailableReport.trafficUsageTable,
    audienceUsageTable: adjustedLiveReport?.audienceUsageTable ?? unavailableReport.audienceUsageTable,
    regionalTrafficTable: adjustedLiveReport?.regionalTrafficTable ?? unavailableReport.regionalTrafficTable,
    regionalTrafficTotalCost:
      adjustedLiveReport?.regionalTrafficTotalCost ?? unavailableReport.regionalTrafficTotalCost,
  };
}
