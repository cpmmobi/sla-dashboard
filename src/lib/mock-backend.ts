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
  fetchLiveDomainTrafficSummaryResult,
  type LiveDomainReportData,
  type LiveDomainReportFailureReason,
  type LiveDomainReportResult,
} from "@/lib/aliyun-live";
import { ALL_CLIENT_DOMAINS } from "@/lib/client-report-constants";
import { CustomerStatus, Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import {
  defaultReportFilters,
  normalizeBillingCycleReportFilters,
  normalizeClientReportFilters,
  type ReportFilters,
} from "@/lib/report-query";

export type CustomerRecord = {
  id: string;
  name: string;
  authCode: string;
  domains: string[];
  status: CustomerStatus;
  notes: string;
  accountManagerEmail: string | null;
  renewalDay: number | null;
  monthlyGiftTrafficGb: number | null;
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

export type TrafficBoardPeriod =
  | "cycle"
  | "lastCycle"
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
  trafficHint: string | null;
  canRetry: boolean;
  trafficMarkupPercent: number | null;
  monthlyGiftTrafficGb: number | null;
  giftUsageRate: string | null;
  projectedMonthTraffic: string | null;
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
};

export type TrafficBoardView = {
  metrics: Metric[];
  rows: TrafficBoardRow[];
  generatedAt: string;
  cycleHint: string;
  period: TrafficBoardPeriod;
  trafficLabel: string;
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

function normalizeMonthlyGiftTrafficGb(value?: number | null): number | null {
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
  monthlyGiftTrafficGb: number | null;
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
    monthlyGiftTrafficGb: normalizeMonthlyGiftTrafficGb(customer.monthlyGiftTrafficGb),
    trafficMarkupPercent: normalizeTrafficMarkupPercent(customer.trafficMarkupPercent),
  };
}

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

function formatPercent(value: number, locale: Locale) {
  return `${value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
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

function formatRenewalDayDisplay(renewalDay: number | null, locale: Locale) {
  const normalizedRenewalDay = renewalDay ?? 1;

  if (renewalDay === null) {
    return locale === "en"
      ? `Day ${normalizedRenewalDay} (default)`
      : `每月 ${normalizedRenewalDay} 号（默认）`;
  }

  return locale === "en" ? `Day ${normalizedRenewalDay}` : `每月 ${normalizedRenewalDay} 号`;
}

function getCurrentBillingCycleMeta(
  renewalDay: number | null,
  locale: Locale,
  now: Date,
  offsetMinutes = 8 * 60,
) {
  const normalizedRenewalDay = renewalDay ?? 1;
  const current = getDatePartsAtOffset(now, offsetMinutes);
  const currentMonthRenewalDay = Math.min(normalizedRenewalDay, getDaysInMonth(current.year, current.month));

  let cycleYear = current.year;
  let cycleMonth = current.month;

  if (current.day < currentMonthRenewalDay) {
    if (cycleMonth === 1) {
      cycleYear -= 1;
      cycleMonth = 12;
    } else {
      cycleMonth -= 1;
    }
  }

  const cycleStartDay = Math.min(normalizedRenewalDay, getDaysInMonth(cycleYear, cycleMonth));
  const nextMonthYear = cycleMonth === 12 ? cycleYear + 1 : cycleYear;
  const nextMonth = cycleMonth === 12 ? 1 : cycleMonth + 1;
  const nextRenewalDay = Math.min(normalizedRenewalDay, getDaysInMonth(nextMonthYear, nextMonth));
  const nextRenewalUtc =
    Date.UTC(nextMonthYear, nextMonth - 1, nextRenewalDay, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
  const cycleStartUtc = Date.UTC(cycleYear, cycleMonth - 1, cycleStartDay, 0, 0, 0, 0) - offsetMinutes * 60 * 1000;
  const daysUntilRenewal = Math.max(
    0,
    Math.ceil((nextRenewalUtc - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const cycleElapsedDays = Math.max(
    1 / (24 * 60),
    (now.getTime() - cycleStartUtc) / (24 * 60 * 60 * 1000),
  );
  const cycleTotalDays = Math.max(
    cycleElapsedDays,
    (nextRenewalUtc - cycleStartUtc) / (24 * 60 * 60 * 1000),
  );

  return {
    filters: {
      queryType: "traffic" as const,
      timeRange: "custom" as const,
      area: "all" as const,
      from: formatLocalDateTime(cycleYear, cycleMonth, cycleStartDay, 0, 0),
      to: formatLocalDateTime(current.year, current.month, current.day, current.hour, current.minute),
      timeZone: "Asia/Shanghai",
      timeZoneOffsetMinutes: offsetMinutes,
      locations: [],
    },
    cycleRange: `${formatBillingRangeDate(cycleMonth, cycleStartDay, locale)} - ${formatBillingRangeDate(
      current.month,
      current.day,
      locale,
    )}`,
    renewalDayDisplay: formatRenewalDayDisplay(renewalDay, locale),
    daysUntilRenewal,
    windowElapsedDays: cycleElapsedDays,
    windowTotalDays: cycleTotalDays,
    cycleStartYear: cycleYear,
    cycleStartMonth: cycleMonth,
    cycleStartDay,
    normalizedRenewalDay,
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
  const { year: previousCycleYear, month: previousCycleMonth } = getPreviousYearMonth(
    currentCycle.cycleStartYear,
    currentCycle.cycleStartMonth,
  );
  const previousCycleStartDay = Math.min(
    currentCycle.normalizedRenewalDay,
    getDaysInMonth(previousCycleYear, previousCycleMonth),
  );
  const previousCycleStartUtc =
    Date.UTC(previousCycleYear, previousCycleMonth - 1, previousCycleStartDay, 0, 0, 0, 0) -
    currentCycle.offsetMinutes * 60 * 1000;
  const currentCycleStartUtc =
    Date.UTC(currentCycle.cycleStartYear, currentCycle.cycleStartMonth - 1, currentCycle.cycleStartDay, 0, 0, 0, 0) -
    currentCycle.offsetMinutes * 60 * 1000;
  const previousCycleEndParts = getDatePartsAtOffset(
    new Date(currentCycleStartUtc - 60 * 1000),
    currentCycle.offsetMinutes,
  );
  const previousCycleTotalDays = Math.max(
    1,
    Math.ceil((currentCycleStartUtc - previousCycleStartUtc) / (24 * 60 * 60 * 1000)),
  );

  return {
    filters: {
      queryType: "traffic" as const,
      timeRange: "custom" as const,
      area: "all" as const,
      from: formatLocalDateTime(previousCycleYear, previousCycleMonth, previousCycleStartDay, 0, 0),
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
    cycleRange: `${formatBillingRangeDate(previousCycleMonth, previousCycleStartDay, locale)} - ${formatBillingRangeDate(
      previousCycleEndParts.month,
      previousCycleEndParts.day,
      locale,
    )}`,
    renewalDayDisplay: locale === "en" ? "Previous Billing Cycle" : "上一账期",
    daysUntilRenewal: 0,
    windowElapsedDays: previousCycleTotalDays,
    windowTotalDays: previousCycleTotalDays,
  };
}

function shouldShowGiftTrafficMetrics(period: TrafficBoardPeriod) {
  return period === "cycle" || period === "lastCycle";
}

function shouldShowGiftTrafficProjection(period: TrafficBoardPeriod) {
  return period === "cycle" || period === "lastCycle";
}

function buildTrafficBoardFilters(period: TrafficBoardPeriod, renewalDay: number | null, locale: Locale, now: Date) {
  if (period === "cycle") {
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

  return `/admin/reports?${params.toString()}`;
}

function getTrafficMetricLabel(locale: Locale, period: TrafficBoardPeriod) {
  if (locale === "en") {
    if (period === "today") {
      return "Today's Traffic";
    }

    if (period === "last24") {
      return "Last 24 Hours Traffic";
    }

    if (period === "lastCycle") {
      return "Previous Billing Cycle Traffic";
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

    return "Billing Cycle Traffic";
  }

  if (period === "today") {
    return "今日流量";
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

  return "账期累计流量";
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
    if (period === "cycle") {
      return "Billing-cycle traffic is accumulated from each customer's renewal day to now, using Asia/Shanghai.";
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
    return "账期累计流量会从每个客户的续费日起累计到当前，按北京时间统计。";
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

  if (locale === "en") {
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
    regionalTrafficTotalCost: formatUsd(
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
) {
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
  const syncText = reports[0]?.syncText ?? (locale === "en" ? "Alibaba Cloud" : "阿里云");

  return {
    report: {
      metrics: buildAllDomainsTrafficMetrics(locale, syncText, trafficTrend, peakBandwidth),
      syncText,
      pvUvTrend: [] as DualSeriesPoint[],
      trafficTrend,
      peakBandwidth,
      highlights: [] as ActivityItem[],
      trafficUsageTable: aggregateTrafficUsageTable(reports, locale),
      audienceUsageTable: [] as TableRow[],
      regionalTrafficTable: aggregatedRegional.rows,
      regionalTrafficTotalCost: aggregatedRegional.totalCost,
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
    trafficHint:
      customer.status !== "正常"
        ? getTrafficBoardHint(locale, "inactive")
        : customer.domains.length === 0
          ? getTrafficBoardHint(locale, "no_domains")
          : null,
    canRetry: false,
    trafficMarkupPercent: customer.trafficMarkupPercent,
    monthlyGiftTrafficGb: customer.monthlyGiftTrafficGb,
    giftUsageRate: null,
    projectedMonthTraffic: null,
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

  const reportResult = await buildAllDomainsTrafficSummary(customer.domains, base.filters);
  const hasLiveData = reportResult.matchedDomainCount > 0;
  const trafficGb = hasLiveData
    ? applyTrafficMarkupToGb(reportResult.totalTrafficGb, customer.trafficMarkupPercent)
    : 0;
  const trafficHint = hasLiveData
    ? reportResult.matchedDomainCount < customer.domains.length
      ? getTrafficBoardHint(
          locale,
          "partial_domains",
          reportResult.matchedDomainCount,
          customer.domains.length,
        )
      : null
    : getTrafficBoardHint(locale, reportResult.failureReason ?? "request_failed");
  const canRetry = hasLiveData
    ? reportResult.matchedDomainCount < customer.domains.length
    : reportResult.failureReason === "request_failed" ||
        reportResult.failureReason === "domain_not_found";
  const selectedGiftTrafficAvailable =
    shouldShowGiftTrafficMetrics(period) &&
    customer.monthlyGiftTrafficGb &&
    (reportResult.matchedDomainCount > 0 || reportResult.failureReason === "empty");
  const selectedGiftTrafficGb = hasLiveData ? trafficGb : 0;
  const giftUsageRate =
    customer.monthlyGiftTrafficGb && customer.monthlyGiftTrafficGb > 0 && selectedGiftTrafficAvailable
      ? formatPercent((selectedGiftTrafficGb / customer.monthlyGiftTrafficGb) * 100, locale)
      : null;
  const projectedPeriodTrafficGb =
    shouldShowGiftTrafficProjection(period) &&
    selectedGiftTrafficAvailable &&
    base.windowElapsedDays &&
    base.windowTotalDays &&
    base.windowElapsedDays > 0
      ? Number(((selectedGiftTrafficGb / base.windowElapsedDays) * base.windowTotalDays).toFixed(2))
      : null;

  console.info(
    `Traffic board row query finished ${stringifyTrafficBoardLog({
      ...requestDebug,
        hasLiveData,
      trafficGb,
        traffic: hasLiveData ? formatTrafficFromGb(trafficGb, locale) : "--",
      matchedDomainCount: reportResult.matchedDomainCount,
      failureReason: reportResult.failureReason,
      trafficHint,
      monthlyGiftTrafficGb: customer.monthlyGiftTrafficGb,
      giftUsageRate,
      selectedGiftTrafficGb,
      projectedPeriodTrafficGb,
      durationMs: Date.now() - startedAt,
    })}`,
  );

  return {
    row: {
      ...base.baseRow,
      traffic: hasLiveData ? formatTrafficFromGb(trafficGb, locale) : "--",
      hasLiveData,
      trafficGb,
      trafficHint,
      canRetry,
      monthlyGiftTrafficGb: customer.monthlyGiftTrafficGb,
      giftUsageRate,
      projectedMonthTraffic: projectedPeriodTrafficGb ? formatTrafficFromGb(projectedPeriodTrafficGb, locale) : null,
    },
    daysUntilRenewal: base.daysUntilRenewal,
  };
}

export async function getTrafficBoardShellView(
  locale: Locale,
  adminSession: AdminSession,
  period: TrafficBoardPeriod = "cycle",
  now = new Date(),
): Promise<TrafficBoardShellView> {
  const customers: CustomerRecord[] = (await getCustomersForAdmin(adminSession)).map(toCustomerRecord);
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
  const customers: CustomerRecord[] = (await getCustomersForAdmin(adminSession)).map(toCustomerRecord);

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
  };
}

export function getCustomers() {
  return prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
  });
}

export function getCustomersForAdmin(adminSession: AdminSession) {
  return prisma.customer.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    return firstCustomer ? toCustomerRecord(firstCustomer) : null;
  }

  const customer = await prisma.customer.findUnique({
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
  monthlyGiftTrafficGb?: number | null;
  trafficMarkupPercent?: number | null;
  notes?: string;
}) {
  const domains = normalizeDomains(input.domains);
  const accountManagerEmail = isSuperAdmin(input.adminSession)
    ? normalizeAccountManagerEmail(input.accountManagerEmail)
    : input.adminSession.username;
  const renewalDay = normalizeRenewalDay(input.renewalDay);
  const monthlyGiftTrafficGb = normalizeMonthlyGiftTrafficGb(input.monthlyGiftTrafficGb);
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
      monthlyGiftTrafficGb,
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
    monthlyGiftTrafficGb?: number | null;
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
  const monthlyGiftTrafficGb = normalizeMonthlyGiftTrafficGb(input.monthlyGiftTrafficGb);
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
      monthlyGiftTrafficGb,
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
  const allDomainsReportResult =
    selectedCustomer && selectedDomain
      ? selectedDomain === ALL_CLIENT_DOMAINS
        ? await buildAllDomainsTrafficReport(selectedCustomer.domains, effectiveFilters, locale)
        : null
      : null;
  const liveReportResult =
    selectedCustomer && selectedDomain
      ? selectedDomain === ALL_CLIENT_DOMAINS
        ? allDomainsReportResult?.report ?? null
        : await fetchLiveDomainReport(selectedDomain, effectiveFilters, locale)
      : null;
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
      ? applyTrafficMarkupToLiveReportData(liveReportResult, selectedCustomer.trafficMarkupPercent, locale)
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
    ? await buildAllDomainsTrafficReport(customer.domains, effectiveFilters, locale)
    : null;
  const liveReport = shouldAggregateAllDomains
    ? allDomainsReportResult?.report ?? null
    : await fetchLiveDomainReport(selectedDomain, effectiveFilters, locale);
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
