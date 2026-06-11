import type { Locale } from "@/lib/i18n";

export type ReportTimeRange =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "cycle"
  | "lastCycle"
  | "custom";
export type ReportArea = "all" | "mainland" | "overseas" | "custom";
export type ReportQueryMode = "traffic" | "audience";
export type ReportLocationOption = {
  value: string;
  label: {
    "zh-CN": string;
    en: string;
  };
};

export type ReportFilters = {
  customerId?: string;
  domain?: string;
  queryType?: ReportQueryMode;
  timeRange: ReportTimeRange;
  area: ReportArea;
  locations?: string[];
  from?: string;
  to?: string;
  timeZone?: string;
  timeZoneOffsetMinutes?: number;
  renewalDay?: number;
};

export type ResolvedReportWindow = {
  startTime: string;
  endTime: string;
  interval: "300" | "3600" | "86400";
  fromDisplay: string;
  toDisplay: string;
};

const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_TIME_ZONE_OFFSET_MINUTES = 8 * 60;
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
export const CLIENT_REPORT_MIN_DATE = "2026-05-28";
export const HKMO_LOCATION_VALUES = ["xianggang", "aomen", "taiwan"] as const;
export const POPULAR_REPORT_LOCATIONS: ReportLocationOption[] = [
  { value: "Singapore", label: { "zh-CN": "新加坡", en: "Singapore" } },
  { value: "India", label: { "zh-CN": "印度", en: "India" } },
  { value: "Indonesia", label: { "zh-CN": "印度尼西亚", en: "Indonesia" } },
  { value: "Thailand", label: { "zh-CN": "泰国", en: "Thailand" } },
  { value: "Cambodia", label: { "zh-CN": "柬埔寨", en: "Cambodia" } },
  { value: "Myanmar", label: { "zh-CN": "缅甸", en: "Myanmar" } },
  { value: "Malaysia", label: { "zh-CN": "马来西亚", en: "Malaysia" } },
  { value: "United Kingdom", label: { "zh-CN": "英国", en: "United Kingdom" } },
  { value: "Canada", label: { "zh-CN": "加拿大", en: "Canada" } },
  { value: "United States", label: { "zh-CN": "美国", en: "United States" } },
  { value: "Mexico", label: { "zh-CN": "墨西哥", en: "Mexico" } },
  { value: "France", label: { "zh-CN": "法国", en: "France" } },
  { value: "Vietnam", label: { "zh-CN": "越南", en: "Vietnam" } },
  { value: "Australia", label: { "zh-CN": "澳大利亚", en: "Australia" } },
  { value: "Russian Federation", label: { "zh-CN": "俄罗斯", en: "Russian Federation" } },
  { value: "Germany", label: { "zh-CN": "德国", en: "Germany" } },
  { value: "Brazil", label: { "zh-CN": "巴西", en: "Brazil" } },
  { value: "South Africa", label: { "zh-CN": "南非", en: "South Africa" } },
  { value: "United Arab Emirates", label: { "zh-CN": "阿联酋", en: "United Arab Emirates" } },
  { value: "Philippines", label: { "zh-CN": "菲律宾", en: "Philippines" } },
  { value: "Japan", label: { "zh-CN": "日本", en: "Japan" } },
  { value: "Korea", label: { "zh-CN": "韩国", en: "Korea" } },
  { value: "xianggang", label: { "zh-CN": "香港", en: "Hong Kong" } },
  { value: "aomen", label: { "zh-CN": "澳门", en: "Macau" } },
  { value: "taiwan", label: { "zh-CN": "台湾", en: "Taiwan" } },
];
const VALID_REPORT_LOCATION_VALUES = new Set(POPULAR_REPORT_LOCATIONS.map((item) => item.value));

export const defaultReportFilters: ReportFilters = {
  timeRange: "today",
  area: "all",
  locations: [],
};

function isTimeRange(value: string | undefined): value is ReportTimeRange {
  return (
    value === "today" ||
    value === "yesterday" ||
    value === "last7" ||
    value === "last30" ||
    value === "cycle" ||
    value === "lastCycle" ||
    value === "custom"
  );
}

function isArea(value: string | undefined): value is ReportArea {
  return value === "all" || value === "mainland" || value === "overseas" || value === "custom";
}

function isQueryMode(value: string | undefined): value is ReportQueryMode {
  return value === "traffic" || value === "audience";
}

function normalizeReportLocations(locations: string[]) {
  const unique = new Set<string>();

  for (const location of locations) {
    const normalized = location.trim();

    if (VALID_REPORT_LOCATION_VALUES.has(normalized)) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
}

function parseLocationsParam(value?: string) {
  if (!value) {
    return [];
  }

  return normalizeReportLocations(value.split(","));
}

function toIsoWithoutMilliseconds(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeTimeZone(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

function parseTimeZoneOffsetMinutes(value?: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const normalized = Math.trunc(parsed);
  return normalized >= -12 * 60 && normalized <= 14 * 60 ? normalized : undefined;
}

function getDatePartsAtOffset(date: Date, offsetMinutes: number) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const year = String(shifted.getUTCFullYear());
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return { year, month, day, date: `${year}-${month}-${day}` };
}

function getDetailedDatePartsAtOffset(date: Date, offsetMinutes: number) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function formatTimeAtOffset(date: Date, offsetMinutes: number) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatLocalDateTimeAtOffset(date: Date, offsetMinutes: number) {
  return `${getDatePartsAtOffset(date, offsetMinutes).date} ${formatTimeAtOffset(date, offsetMinutes)}`;
}

function fromLocalWithOffset(date: string, time: string, offsetMinutes: number) {
  const [year = "1970", month = "01", day = "01"] = date.split("-");
  const [hour = "00", minute = "00"] = time.split(":");
  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0,
    ) -
    offsetMinutes * 60 * 1000;

  return new Date(utcMs);
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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

function getCurrentBillingCycleRange(
  renewalDay: number | null | undefined,
  offsetMinutes: number,
  now: Date,
) {
  const normalizedRenewalDay =
    typeof renewalDay === "number" && Number.isInteger(renewalDay) && renewalDay >= 1 && renewalDay <= 31
      ? renewalDay
      : 1;
  const current = getDetailedDatePartsAtOffset(now, offsetMinutes);
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

  return {
    from: formatLocalDateTime(cycleYear, cycleMonth, cycleStartDay, 0, 0),
    to: formatLocalDateTime(current.year, current.month, current.day, current.hour, current.minute),
    cycleYear,
    cycleMonth,
    cycleStartDay,
    normalizedRenewalDay,
  };
}

function getPreviousBillingCycleRange(
  renewalDay: number | null | undefined,
  offsetMinutes: number,
  now: Date,
) {
  const currentCycle = getCurrentBillingCycleRange(renewalDay, offsetMinutes, now);
  const previousCycleMonth = currentCycle.cycleMonth === 1 ? 12 : currentCycle.cycleMonth - 1;
  const previousCycleYear =
    currentCycle.cycleMonth === 1 ? currentCycle.cycleYear - 1 : currentCycle.cycleYear;
  const previousCycleStartDay = Math.min(
    currentCycle.normalizedRenewalDay,
    getDaysInMonth(previousCycleYear, previousCycleMonth),
  );
  const currentCycleStartUtc =
    Date.UTC(currentCycle.cycleYear, currentCycle.cycleMonth - 1, currentCycle.cycleStartDay, 0, 0, 0, 0) -
    offsetMinutes * 60 * 1000;
  const previousCycleEndLocal = getDetailedDatePartsAtOffset(
    new Date(currentCycleStartUtc - 60 * 1000),
    offsetMinutes,
  );

  return {
    from: formatLocalDateTime(previousCycleYear, previousCycleMonth, previousCycleStartDay, 0, 0),
    to: formatLocalDateTime(
      previousCycleEndLocal.year,
      previousCycleEndLocal.month,
      previousCycleEndLocal.day,
      previousCycleEndLocal.hour,
      previousCycleEndLocal.minute,
    ),
  };
}

export function normalizeBillingCycleReportFilters(
  filters: ReportFilters,
  renewalDay: number | null | undefined,
  now = new Date(),
): ReportFilters {
  if (filters.timeRange !== "cycle" && filters.timeRange !== "lastCycle") {
    return filters;
  }

  const offsetMinutes = filters.timeZoneOffsetMinutes ?? DEFAULT_TIME_ZONE_OFFSET_MINUTES;
  const range =
    filters.timeRange === "cycle"
      ? getCurrentBillingCycleRange(renewalDay, offsetMinutes, now)
      : getPreviousBillingCycleRange(renewalDay, offsetMinutes, now);

  return {
    ...filters,
    renewalDay: renewalDay ?? undefined,
    timeRange: "custom",
    from: range.from,
    to: range.to,
  };
}

function inferInterval(startTime: Date, endTime: Date): "300" | "3600" | "86400" {
  const durationMs = endTime.getTime() - startTime.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (durationMs <= oneDay) {
    return "3600";
  }

  if (durationMs <= 7 * oneDay) {
    return "3600";
  }

  return "86400";
}

export function parseReportFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): ReportFilters {
  const customerId = typeof searchParams?.customerId === "string" ? searchParams.customerId : undefined;
  const domain = typeof searchParams?.domain === "string" ? searchParams.domain : undefined;
  const queryType = isQueryMode(typeof searchParams?.queryType === "string" ? searchParams.queryType : undefined)
    ? (searchParams?.queryType as ReportQueryMode)
    : undefined;
  const timeRange = isTimeRange(typeof searchParams?.range === "string" ? searchParams.range : undefined)
    ? (searchParams?.range as ReportTimeRange)
    : defaultReportFilters.timeRange;
  const rawArea = typeof searchParams?.area === "string" ? searchParams.area : undefined;
  const locations =
    rawArea === "hkmo"
      ? [...HKMO_LOCATION_VALUES]
      : parseLocationsParam(typeof searchParams?.locations === "string" ? searchParams.locations : undefined);
  const area = rawArea === "hkmo"
    ? "custom"
    : isArea(rawArea)
      ? rawArea
      : locations.length > 0
        ? "custom"
        : defaultReportFilters.area;
  const from = typeof searchParams?.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams?.to === "string" ? searchParams.to : undefined;
  const timeZone = normalizeTimeZone(
    typeof searchParams?.tz === "string" ? searchParams.tz : undefined,
  );
  const timeZoneOffsetMinutes = parseTimeZoneOffsetMinutes(
    typeof searchParams?.tzOffset === "string" ? searchParams.tzOffset : undefined,
  );

  return {
    customerId,
    domain,
    queryType,
    timeRange,
    area,
    locations,
    from,
    to,
    timeZone,
    timeZoneOffsetMinutes,
  };
}

export function resolveReportWindow(filters: ReportFilters, now = new Date()): ResolvedReportWindow {
  const normalizedFilters = normalizeBillingCycleReportFilters(filters, filters.renewalDay, now);
  const offsetMinutes = filters.timeZoneOffsetMinutes ?? DEFAULT_TIME_ZONE_OFFSET_MINUTES;
  const localToday = getDatePartsAtOffset(now, offsetMinutes).date;
  const startOfToday = fromLocalWithOffset(localToday, "00:00", offsetMinutes);

  let startTime: Date;
  let endTime: Date;

  if (normalizedFilters.timeRange === "custom" && normalizedFilters.from && normalizedFilters.to) {
    const fromDate = fromLocalWithOffset(
      normalizedFilters.from.slice(0, 10),
      normalizedFilters.from.slice(11, 16),
      offsetMinutes,
    );
    const toDate = fromLocalWithOffset(
      normalizedFilters.to.slice(0, 10),
      normalizedFilters.to.slice(11, 16),
      offsetMinutes,
    );
    startTime = fromDate;
    endTime = toDate > fromDate ? toDate : new Date(fromDate.getTime() + 60 * 60 * 1000);
  } else if (normalizedFilters.timeRange === "yesterday") {
    startTime = shiftDays(startOfToday, -1);
    endTime = startOfToday;
  } else if (normalizedFilters.timeRange === "last7") {
    startTime = shiftDays(startOfToday, -6);
    endTime = now;
  } else if (normalizedFilters.timeRange === "last30") {
    startTime = shiftDays(startOfToday, -29);
    endTime = now;
  } else {
    startTime = startOfToday;
    endTime = now;
  }

  if (endTime.getTime() - startTime.getTime() > MAX_RANGE_MS) {
    startTime = new Date(endTime.getTime() - MAX_RANGE_MS);
  }

  return {
    startTime: toIsoWithoutMilliseconds(startTime),
    endTime: toIsoWithoutMilliseconds(endTime),
    interval: inferInterval(startTime, endTime),
    fromDisplay: `${getDatePartsAtOffset(startTime, offsetMinutes).date} ${formatTimeAtOffset(
      startTime,
      offsetMinutes,
    )}`,
    toDisplay: `${getDatePartsAtOffset(endTime, offsetMinutes).date} ${formatTimeAtOffset(
      endTime,
      offsetMinutes,
    )}`,
  };
}

export function normalizeClientReportFilters(filters: ReportFilters, now = new Date()): ReportFilters {
  if (
    (filters.timeRange === "cycle" || filters.timeRange === "lastCycle") &&
    typeof filters.renewalDay !== "number"
  ) {
    return filters;
  }

  const offsetMinutes = filters.timeZoneOffsetMinutes ?? DEFAULT_TIME_ZONE_OFFSET_MINUTES;
  const minimumStartTime = fromLocalWithOffset(CLIENT_REPORT_MIN_DATE, "00:00", offsetMinutes);
  const resolvedWindow = resolveReportWindow(filters, now);
  const resolvedStartTime = new Date(resolvedWindow.startTime);
  const resolvedEndTime = new Date(resolvedWindow.endTime);

  if (resolvedStartTime.getTime() >= minimumStartTime.getTime()) {
    return filters;
  }

  const clampedEndTime =
    resolvedEndTime.getTime() > minimumStartTime.getTime()
      ? resolvedEndTime
      : new Date(minimumStartTime.getTime() + 60 * 60 * 1000);

  return {
    ...filters,
    timeRange: "custom",
    from: `${CLIENT_REPORT_MIN_DATE} 00:00`,
    to: formatLocalDateTimeAtOffset(clampedEndTime, offsetMinutes),
  };
}

export function splitDateTime(
  value?: string,
  offsetMinutes: number = DEFAULT_TIME_ZONE_OFFSET_MINUTES,
) {
  if (!value || !value.includes(" ")) {
    return {
      date: getDatePartsAtOffset(new Date(), offsetMinutes).date,
      time: "00:00",
    };
  }

  const [date, time] = value.split(" ");
  return {
    date,
    time: time?.slice(0, 5) ?? "00:00",
  };
}

export function serializeCustomRange(date: string, time: string) {
  return `${date} ${time}`;
}

export function serializeReportLocations(locations: string[]) {
  return normalizeReportLocations(locations).join(",");
}

export function formatUtcOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(minutes);
  const hour = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minute = String(absoluteMinutes % 60).padStart(2, "0");

  return minute === "00" ? `UTC${sign}${Number(hour)}` : `UTC${sign}${hour}:${minute}`;
}

export function getResolvedReportTimeZone(filters: ReportFilters) {
  return filters.timeZone ?? DEFAULT_TIME_ZONE;
}

export function getResolvedReportTimeZoneOffsetMinutes(filters: ReportFilters) {
  return filters.timeZoneOffsetMinutes ?? DEFAULT_TIME_ZONE_OFFSET_MINUTES;
}

export function isHkmoSelection(locations: string[]) {
  const normalized = normalizeReportLocations(locations);
  return (
    normalized.length === HKMO_LOCATION_VALUES.length &&
    HKMO_LOCATION_VALUES.every((value) => normalized.includes(value))
  );
}

export function getReportLocationLabel(location: string, locale: Locale) {
  return (
    POPULAR_REPORT_LOCATIONS.find((item) => item.value === location)?.label[locale] ?? location
  );
}

export function getAliyunLocationNameEn(filters: ReportFilters) {
  const locations = normalizeReportLocations(filters.locations ?? []);
  return locations.length > 0 ? locations.join(",") : undefined;
}

export function mapReportAreaToAliyunArea(area: ReportArea) {
  switch (area) {
    case "mainland":
      return "CN";
    case "overseas":
      return "OverSeas";
    case "custom":
      return undefined;
    default:
      return "all";
  }
}
