import { Config as OpenApiConfig } from "@alicloud/openapi-client";
import Client, {
  DescribeDomainUsageDataRequest,
  DescribeLiveDomainBpsDataByLayerRequest,
  DescribeLiveDomainTrafficDataRequest,
  DescribeLiveDomainPvUvDataRequest,
} from "@alicloud/live20161101";
import type { DualSeriesPoint, Metric, RegionTrafficRow, SeriesPoint, TableRow } from "@/lib/dashboard-data";
import type { Locale } from "@/lib/i18n";
import {
  getAliyunLocationNameEn,
  mapReportAreaToAliyunArea,
  type ReportFilters,
  resolveReportWindow,
} from "@/lib/report-query";

type AnalyticsPoint = {
  timestamp: string;
  trafficBytes: number;
  bps: number;
  pv: number;
  uv: number;
};

export type LiveDomainReportData = {
  metrics: Metric[];
  trafficTrend: SeriesPoint[];
  peakBandwidth: SeriesPoint[];
  pvUvTrend: DualSeriesPoint[];
  trafficUsageTable: TableRow[];
  audienceUsageTable: TableRow[];
  regionalTrafficTable: RegionTrafficRow[];
  regionalTrafficTotalCost: string;
  syncText: string;
};

export type LiveDomainReportFailureReason = "domain_not_found" | "empty" | "request_failed";

export type LiveDomainReportResult = {
  data: LiveDomainReportData | null;
  reason: LiveDomainReportFailureReason | null;
};

export type LiveDomainTrafficSummaryData = {
  totalTrafficGb: number;
};

export type LiveDomainTrafficSummaryResult = {
  data: LiveDomainTrafficSummaryData | null;
  reason: LiveDomainReportFailureReason | null;
};

type RegionalTrafficSummary = {
  code: string;
  label: string;
  trafficBytes: number;
  sortOrder: number;
};

const ALIYUN_TRAFFIC_AREAS = [
  {
    code: "CN",
    label: { "zh-CN": "中国大陆（需ICP备案）", en: "Mainland China" },
  },
  {
    code: "AP1",
    label: { "zh-CN": "亚太一区", en: "Asia Pacific 1" },
  },
  {
    code: "AP2",
    label: { "zh-CN": "亚太二区", en: "Asia Pacific 2" },
  },
  {
    code: "AP3",
    label: { "zh-CN": "亚太三区", en: "Asia Pacific 3" },
  },
  {
    code: "EU",
    label: { "zh-CN": "欧洲", en: "Europe" },
  },
  {
    code: "NA",
    label: { "zh-CN": "北美", en: "North America" },
  },
  {
    code: "SA",
    label: { "zh-CN": "南美", en: "South America" },
  },
  {
    code: "MEAA",
    label: { "zh-CN": "中东和非洲", en: "Middle East & Africa" },
  },
] as const;

const REGIONAL_PRICE_PER_TB_USD: Record<(typeof ALIYUN_TRAFFIC_AREAS)[number]["code"], number> = {
  CN: 37,
  AP1: 75,
  AP2: 98,
  AP3: 88,
  EU: 65,
  NA: 65,
  SA: 185,
  MEAA: 185,
};

let cachedClient: Client | null = null;
let cachedClientKey: string | null = null;

function getEnv(name: string) {
  return process.env[name]?.trim();
}

export function hasAliyunLiveConfig() {
  return Boolean(getEnv("ALIYUN_LIVE_ACCESS_KEY_ID") && getEnv("ALIYUN_LIVE_ACCESS_KEY_SECRET"));
}

function getAliyunLiveEndpoint() {
  return getEnv("ALIYUN_LIVE_ENDPOINT") || "live.aliyuncs.com";
}

function getAliyunLiveClient() {
  if (!hasAliyunLiveConfig()) {
    return null;
  }

  const regionId = getEnv("ALIYUN_LIVE_REGION_ID") || "cn-shanghai";
  const endpoint = getAliyunLiveEndpoint();
  const clientKey = `${regionId}:${endpoint}`;

  if (cachedClient && cachedClientKey === clientKey) {
    return cachedClient;
  }

  cachedClient = new Client(
    new OpenApiConfig({
      accessKeyId: getEnv("ALIYUN_LIVE_ACCESS_KEY_ID"),
      accessKeySecret: getEnv("ALIYUN_LIVE_ACCESS_KEY_SECRET"),
      securityToken: getEnv("ALIYUN_LIVE_SECURITY_TOKEN"),
      regionId,
      endpoint,
      protocol: "HTTPS",
      connectTimeout: 15000,
      readTimeout: 20000,
    }),
  );
  cachedClientKey = clientKey;

  return cachedClient;
}

function parseNumericValue(value?: string) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function simplifyError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  const details = error as Error & {
    code?: string;
    data?: Record<string, unknown>;
    statusCode?: number;
  };

  return {
    name: details.name,
    message: details.message,
    code: details.code,
    statusCode: details.statusCode,
    data: details.data,
  };
}

function getAliyunErrorCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const details = error as Error & {
    code?: string;
  };

  return details.code ?? "";
}

function isAliyunDomainNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorCode = getAliyunErrorCode(error);
  return errorCode === "InvalidDomain.NotFound" || error.message.includes("InvalidDomain.NotFound");
}

function summarizeModules(
  modules: Array<{ timeStamp?: string; value?: string; trafficValue?: string }>,
) {
  return {
    count: modules.length,
    nonZeroCount: modules.filter((item) =>
      parseNumericValue("trafficValue" in item ? item.trafficValue : item.value) > 0,
    ).length,
    sample: modules.slice(0, 3).map((item) => ({
      timeStamp: item.timeStamp,
      value: "trafficValue" in item ? item.trafficValue : item.value,
    })),
  };
}

function stringifyDebugPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function isRetryableAliyunError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "RequestTimeoutError" ||
    error.message.includes("ConnectTimeout") ||
    error.message.includes("ReadTimeout")
  );
}

async function withAliyunRetry<T>(
  label: string,
  requestDebug: Record<string, unknown>,
  factory: () => Promise<T>,
) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        console.warn(
          `Alibaba Cloud Live API retrying ${stringifyDebugPayload({
            ...requestDebug,
            label,
            attempt,
          })}`,
        );
      }

      return await factory();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableAliyunError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Alibaba Cloud retry exhausted");
}

function toBucketStart(timestampMs: number, startMs: number, intervalMs: number) {
  return startMs + Math.floor((timestampMs - startMs) / intervalMs) * intervalMs;
}

function sortAnalyticsPoints(points: AnalyticsPoint[]) {
  return [...points].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function inferIntervalSeconds(points: AnalyticsPoint[], fallbackSeconds: number) {
  if (points.length < 2) {
    return fallbackSeconds;
  }

  const sorted = sortAnalyticsPoints(points);
  let minDiffSeconds = Number.POSITIVE_INFINITY;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(sorted[index - 1].timestamp).getTime();
    const current = new Date(sorted[index].timestamp).getTime();
    const diffSeconds = Math.round((current - previous) / 1000);

    if (diffSeconds > 0) {
      minDiffSeconds = Math.min(minDiffSeconds, diffSeconds);
    }
  }

  return Number.isFinite(minDiffSeconds) ? minDiffSeconds : fallbackSeconds;
}

function buildContinuousAnalyticsPoints(
  points: AnalyticsPoint[],
  startTime: string,
  endTime: string,
  intervalSeconds: number,
) {
  if (points.length === 0) {
    return [];
  }

  const intervalMs = Math.max(intervalSeconds, 300) * 1000;
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const bucketMap = new Map<number, AnalyticsPoint>();

  for (const point of points) {
    const timestampMs = new Date(point.timestamp).getTime();
    const bucketStartMs = toBucketStart(timestampMs, startMs, intervalMs);
    const bucketStart = new Date(bucketStartMs).toISOString();
    const current = bucketMap.get(bucketStartMs);

    if (current) {
      current.trafficBytes += point.trafficBytes;
      current.bps = Math.max(current.bps, point.bps);
      current.pv += point.pv;
      current.uv += point.uv;
      continue;
    }

    bucketMap.set(bucketStartMs, {
      timestamp: bucketStart,
      trafficBytes: point.trafficBytes,
      bps: point.bps,
      pv: point.pv,
      uv: point.uv,
    });
  }

  const filledPoints: AnalyticsPoint[] = [];

  for (let bucketStartMs = startMs; bucketStartMs <= endMs; bucketStartMs += intervalMs) {
    filledPoints.push(
      bucketMap.get(bucketStartMs) ?? {
        timestamp: new Date(bucketStartMs).toISOString(),
        trafficBytes: 0,
        bps: 0,
        pv: 0,
        uv: 0,
      },
    );
  }

  return filledPoints;
}

function formatTraffic(bytes: number, locale: Locale) {
  if (bytes >= 1024 ** 4) {
    return `${(bytes / 1024 ** 4).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })} TB`;
  }

  return `${(bytes / 1024 ** 3).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} GB`;
}

function formatTrafficValue(bytes: number) {
  return Number((bytes / 1024 ** 3).toFixed(2));
}

function formatBandwidth(bps: number, locale: Locale) {
  if (bps >= 1_000_000_000) {
    return `${(bps / 1_000_000_000).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })} Gbps`;
  }

  return `${(bps / 1_000_000).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} Mbps`;
}

function formatBandwidthValue(bps: number) {
  return Number((bps / 1_000_000).toFixed(2));
}

function formatCount(value: number, locale: Locale) {
  return value.toLocaleString(locale === "en" ? "en-US" : "zh-CN");
}

function formatShare(value: number, locale: Locale) {
  return `${value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatUsd(value: number, locale: Locale) {
  return `${value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}

function formatChartLabel(timestamp: string, startTime: string, endTime: string) {
  const date = new Date(timestamp);
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const useDate = durationMs > 48 * 60 * 60 * 1000;

  return date.toLocaleString("en-CA", {
    month: "2-digit",
    day: "2-digit",
    hour: useDate ? undefined : "2-digit",
    minute: useDate ? undefined : "2-digit",
    hour12: false,
  }).replace(",", "");
}

function formatTooltipLabel(timestamp: string, offsetMinutes: number) {
  const shifted = new Date(new Date(timestamp).getTime() + offsetMinutes * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatTableLabel(timestamp: string) {
  return new Date(timestamp).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMetricTimestamp(timestamp?: string, offsetMinutes = 8 * 60) {
  if (!timestamp) {
    return "--";
  }

  const shifted = new Date(new Date(timestamp).getTime() + offsetMinutes * 60 * 1000);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");

  return `${month}-${day} ${hour}:${minute}`;
}

function formatAverageCount(value: number, locale: Locale) {
  return value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function getPeakPoint(points: AnalyticsPoint[], key: "bps" | "uv" | "pv") {
  return points.reduce<AnalyticsPoint | null>((peak, point) => {
    if (!peak || point[key] > peak[key]) {
      return point;
    }

    return peak;
  }, null);
}

function buildMetrics(
  locale: Locale,
  syncText: string,
  timeZoneOffsetMinutes: number,
  trafficPoints: AnalyticsPoint[],
  bandwidthPoints: AnalyticsPoint[],
  audiencePoints: AnalyticsPoint[],
): Metric[] {
  const totalTrafficBytes = trafficPoints.reduce((sum, point) => sum + point.trafficBytes, 0);
  const averageBps =
    bandwidthPoints.length > 0
      ? bandwidthPoints.reduce((sum, point) => sum + point.bps, 0) / bandwidthPoints.length
      : 0;
  const peakBandwidthPoint = getPeakPoint(bandwidthPoints, "bps");
  const averageUv =
    audiencePoints.length > 0
      ? audiencePoints.reduce((sum, point) => sum + point.uv, 0) / audiencePoints.length
      : 0;
  const peakUvPoint = getPeakPoint(audiencePoints, "uv");
  const averagePv =
    audiencePoints.length > 0
      ? audiencePoints.reduce((sum, point) => sum + point.pv, 0) / audiencePoints.length
      : 0;

  if (locale === "en") {
    return [
      { label: "Total Traffic", value: formatTraffic(totalTrafficBytes, locale), delta: syncText, tone: "brand" },
      { label: "Average Bandwidth", value: formatBandwidth(averageBps, locale), delta: syncText, tone: "success" },
      { label: "Peak Bandwidth", value: formatBandwidth(peakBandwidthPoint?.bps ?? 0, locale), delta: syncText, tone: "warning" },
      { label: "Peak Bandwidth Time", value: formatMetricTimestamp(peakBandwidthPoint?.timestamp, timeZoneOffsetMinutes), delta: syncText, tone: "brand" },
      { label: "UV Peak", value: formatCount(peakUvPoint?.uv ?? 0, locale), delta: syncText, tone: "warning" },
      { label: "Average UV", value: formatAverageCount(averageUv, locale), delta: syncText, tone: "success" },
      { label: "UV Peak Time", value: formatMetricTimestamp(peakUvPoint?.timestamp, timeZoneOffsetMinutes), delta: syncText, tone: "brand" },
      { label: "Average PV", value: formatAverageCount(averagePv, locale), delta: syncText, tone: "brand" },
    ];
  }

  return [
    { label: "累计流量", value: formatTraffic(totalTrafficBytes, locale), delta: syncText, tone: "brand" },
    { label: "平均带宽", value: formatBandwidth(averageBps, locale), delta: syncText, tone: "success" },
    { label: "带宽峰值", value: formatBandwidth(peakBandwidthPoint?.bps ?? 0, locale), delta: syncText, tone: "warning" },
    { label: "峰值时间", value: formatMetricTimestamp(peakBandwidthPoint?.timestamp, timeZoneOffsetMinutes), delta: syncText, tone: "brand" },
    { label: "UV 峰值", value: formatCount(peakUvPoint?.uv ?? 0, locale), delta: syncText, tone: "warning" },
    { label: "平均 UV", value: formatAverageCount(averageUv, locale), delta: syncText, tone: "success" },
    { label: "UV 峰值时间", value: formatMetricTimestamp(peakUvPoint?.timestamp, timeZoneOffsetMinutes), delta: syncText, tone: "brand" },
    { label: "平均 PV", value: formatAverageCount(averagePv, locale), delta: syncText, tone: "brand" },
  ];
}

function buildSeriesPoint(
  point: AnalyticsPoint,
  startTime: string,
  endTime: string,
  timeZoneOffsetMinutes: number,
  value: number,
): SeriesPoint {
  return {
    label: formatChartLabel(point.timestamp, startTime, endTime),
    value,
    tooltipLabel: formatTooltipLabel(point.timestamp, timeZoneOffsetMinutes),
  };
}

function buildDualSeriesPoint(
  point: AnalyticsPoint,
  startTime: string,
  endTime: string,
  timeZoneOffsetMinutes: number,
): DualSeriesPoint {
  return {
    label: formatChartLabel(point.timestamp, startTime, endTime),
    primary: point.pv,
    secondary: point.uv,
    tooltipLabel: formatTooltipLabel(point.timestamp, timeZoneOffsetMinutes),
  };
}

function buildTrafficUsageTable(
  locale: Locale,
  trafficPoints: AnalyticsPoint[],
  bandwidthPoints: AnalyticsPoint[],
) {
  const merged = new Map<string, AnalyticsPoint>();

  for (const point of trafficPoints) {
    merged.set(point.timestamp, { ...point });
  }

  for (const point of bandwidthPoints) {
    const current = merged.get(point.timestamp) ?? {
      timestamp: point.timestamp,
      trafficBytes: 0,
      bps: 0,
      pv: 0,
      uv: 0,
    };

    current.bps = point.bps;
    merged.set(point.timestamp, current);
  }

  return sortAnalyticsPoints(Array.from(merged.values())).map((point) => ({
    period: formatTableLabel(point.timestamp),
    traffic: formatTraffic(point.trafficBytes, locale),
    pv: formatCount(point.pv, locale),
    uv: formatCount(point.uv, locale),
    peakBps: formatBandwidth(point.bps, locale),
  }));
}

function buildAudienceUsageTable(locale: Locale, points: AnalyticsPoint[]) {
  return sortAnalyticsPoints(points).map((point) => ({
    period: formatTableLabel(point.timestamp),
    traffic: formatTraffic(point.trafficBytes, locale),
    pv: formatCount(point.pv, locale),
    uv: formatCount(point.uv, locale),
    peakBps: formatBandwidth(point.bps, locale),
  }));
}

function buildRegionalTrafficTable(locale: Locale, summaries: RegionalTrafficSummary[]): RegionTrafficRow[] {
  const totalTrafficBytes = summaries.reduce((sum, item) => sum + item.trafficBytes, 0);
  const totalEstimatedCost = summaries.reduce((sum, item) => {
    const pricePerTb = REGIONAL_PRICE_PER_TB_USD[item.code as keyof typeof REGIONAL_PRICE_PER_TB_USD] ?? 0;
    return sum + (item.trafficBytes / 1024 ** 4) * pricePerTb;
  }, 0);
  const rows = [...summaries]
    .sort((left, right) =>
      right.trafficBytes === left.trafficBytes
        ? left.sortOrder - right.sortOrder
        : right.trafficBytes - left.trafficBytes,
    )
    .map((item) => ({
      regionCode: item.code,
      region: item.label,
      traffic: formatTraffic(item.trafficBytes, locale),
      share: formatShare(totalTrafficBytes > 0 ? (item.trafficBytes / totalTrafficBytes) * 100 : 0, locale),
      unitPrice: formatUsd(
        REGIONAL_PRICE_PER_TB_USD[item.code as keyof typeof REGIONAL_PRICE_PER_TB_USD] ?? 0,
        locale,
      ),
      cost: formatUsd(
        (item.trafficBytes / 1024 ** 4) *
          (REGIONAL_PRICE_PER_TB_USD[item.code as keyof typeof REGIONAL_PRICE_PER_TB_USD] ?? 0),
        locale,
      ),
    }));

  if (rows.length === 0) {
    return [];
  }

  return [
    ...rows,
    {
      regionCode: "TOTAL",
      region: locale === "en" ? "Total" : "总计",
      traffic: formatTraffic(totalTrafficBytes, locale),
      share: formatShare(100, locale),
      unitPrice: "--",
      cost: formatUsd(totalEstimatedCost, locale),
    },
  ];
}

function normalizeAnalytics(
  locale: Locale,
  startTime: string,
  endTime: string,
  timeZoneOffsetMinutes: number,
  trafficPoints: AnalyticsPoint[],
  trafficIntervalSeconds: number,
  bandwidthPoints: AnalyticsPoint[],
  bandwidthIntervalSeconds: number,
  pvUvPoints: AnalyticsPoint[],
  pvUvIntervalSeconds: number,
  regionalTrafficSummaries: RegionalTrafficSummary[],
): LiveDomainReportData {
  const trafficDisplayPoints = buildContinuousAnalyticsPoints(
    sortAnalyticsPoints(trafficPoints),
    startTime,
    endTime,
    trafficIntervalSeconds,
  );
  const bandwidthDisplayPoints = buildContinuousAnalyticsPoints(
    sortAnalyticsPoints(bandwidthPoints),
    startTime,
    endTime,
    bandwidthIntervalSeconds,
  );
  const pvUvDisplayPoints = buildContinuousAnalyticsPoints(
    sortAnalyticsPoints(pvUvPoints),
    startTime,
    endTime,
    pvUvIntervalSeconds,
  );
  const metricPointsMap = new Map<string, AnalyticsPoint>();

  for (const point of trafficPoints) {
    metricPointsMap.set(point.timestamp, { ...point });
  }

  for (const point of bandwidthPoints) {
    const current = metricPointsMap.get(point.timestamp) ?? {
      timestamp: point.timestamp,
      trafficBytes: 0,
      bps: 0,
      pv: 0,
      uv: 0,
    };

    current.bps = point.bps;
    metricPointsMap.set(point.timestamp, current);
  }

  for (const point of pvUvPoints) {
    const current = metricPointsMap.get(point.timestamp) ?? {
      timestamp: point.timestamp,
      trafficBytes: 0,
      bps: 0,
      pv: 0,
      uv: 0,
    };

    current.pv = point.pv;
    current.uv = point.uv;
    metricPointsMap.set(point.timestamp, current);
  }

  const syncText =
    locale === "en"
      ? `Alibaba Cloud • ${startTime} - ${endTime}`
      : `阿里云 • ${startTime} - ${endTime}`;

  return {
    metrics: buildMetrics(
      locale,
      syncText,
      timeZoneOffsetMinutes,
      trafficDisplayPoints,
      bandwidthDisplayPoints,
      pvUvDisplayPoints,
    ),
    syncText,
    trafficTrend: trafficDisplayPoints.map((point) =>
      buildSeriesPoint(
        point,
        startTime,
        endTime,
        timeZoneOffsetMinutes,
        formatTrafficValue(point.trafficBytes),
      ),
    ),
    peakBandwidth: bandwidthDisplayPoints.map((point) =>
      buildSeriesPoint(
        point,
        startTime,
        endTime,
        timeZoneOffsetMinutes,
        formatBandwidthValue(point.bps),
      ),
    ),
    pvUvTrend: pvUvDisplayPoints.map((point) =>
      buildDualSeriesPoint(point, startTime, endTime, timeZoneOffsetMinutes),
    ),
    trafficUsageTable: buildTrafficUsageTable(locale, trafficDisplayPoints, bandwidthDisplayPoints),
    audienceUsageTable: buildAudienceUsageTable(locale, pvUvDisplayPoints),
    regionalTrafficTable: buildRegionalTrafficTable(locale, regionalTrafficSummaries),
    regionalTrafficTotalCost: formatUsd(
      regionalTrafficSummaries.reduce((sum, item) => {
        const pricePerTb = REGIONAL_PRICE_PER_TB_USD[item.code as keyof typeof REGIONAL_PRICE_PER_TB_USD] ?? 0;
        return sum + (item.trafficBytes / 1024 ** 4) * pricePerTb;
      }, 0),
      locale,
    ),
  };
}

async function fetchRegionalTrafficSummaries(
  client: Client,
  domain: string,
  startTime: string,
  endTime: string,
  interval: string,
  regionId: string,
  locale: Locale,
  requestDebug: Record<string, unknown>,
) {
  const settledResponses = await Promise.allSettled(
    ALIYUN_TRAFFIC_AREAS.map(async (area, sortOrder) => {
      const response = await withAliyunRetry(
        `regionalTraffic:${area.code}`,
        {
          ...requestDebug,
          regionalArea: area.code,
        },
        () =>
          client.describeDomainUsageData(
            new DescribeDomainUsageDataRequest({
              regionId,
              domainName: domain,
              startTime,
              endTime,
              field: "traf",
              type: "all",
              area: area.code,
              dataProtocol: "all",
              interval,
            }),
          ),
      );

      const modules = response.body?.usageDataPerInterval?.dataModule ?? [];

      return {
        code: area.code,
        label: area.label[locale],
        trafficBytes: modules.reduce((sum, item) => sum + parseNumericValue(item.value), 0),
        sortOrder,
      } satisfies RegionalTrafficSummary;
    }),
  );

  return settledResponses.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    console.warn(
      `Alibaba Cloud Live API regional traffic request failed ${stringifyDebugPayload({
        ...requestDebug,
        regionalArea: ALIYUN_TRAFFIC_AREAS[index]?.code ?? null,
        error: simplifyError(result.reason),
      })}`,
    );

    return [];
  });
}

export async function fetchLiveDomainReportResult(
  domain: string,
  filters: ReportFilters,
  locale: Locale,
): Promise<LiveDomainReportResult> {
  const client = getAliyunLiveClient();

  if (!client || !domain) {
    return {
      data: null,
      reason: "request_failed",
    };
  }

  const window = resolveReportWindow(filters);
  const regionId = getEnv("ALIYUN_LIVE_REGION_ID") || "cn-shanghai";
  const endpoint = getAliyunLiveEndpoint();
  const area = mapReportAreaToAliyunArea(filters.area);
  const locationNameEn = getAliyunLocationNameEn(filters);
  const useLocationFilter = Boolean(locationNameEn);
  const requestDebug = {
    domain,
    regionId,
    endpoint,
    area: area ?? null,
    locationNameEn: locationNameEn ?? null,
    queryType: filters.queryType ?? "traffic",
    timeRange: filters.timeRange,
    timeZone: filters.timeZone ?? null,
    timeZoneOffsetMinutes: filters.timeZoneOffsetMinutes ?? null,
    startTime: window.startTime,
    endTime: window.endTime,
    interval: window.interval,
  };

  console.info(
    `Alibaba Cloud Live API request started ${stringifyDebugPayload(requestDebug)}`,
  );

  try {
    const shouldFetchRegionalTraffic = (filters.queryType ?? "traffic") === "traffic";
    const [trafficResponse, bandwidthResponse, pvUvResponse, regionalTrafficSummaries] = await Promise.all([
      withAliyunRetry("traffic", requestDebug, () =>
        useLocationFilter
          ? client.describeLiveDomainTrafficData(
              new DescribeLiveDomainTrafficDataRequest({
                domainName: domain,
                startTime: window.startTime,
                endTime: window.endTime,
                ispNameEn: "all",
                locationNameEn,
              }),
            )
          : client.describeDomainUsageData(
              new DescribeDomainUsageDataRequest({
                regionId,
                domainName: domain,
                startTime: window.startTime,
                endTime: window.endTime,
                field: "traf",
                type: "all",
                area,
                dataProtocol: "all",
                interval: window.interval,
              }),
            ),
      ),
      withAliyunRetry("bandwidth", requestDebug, () =>
        useLocationFilter
          ? client.describeLiveDomainBpsDataByLayer(
              new DescribeLiveDomainBpsDataByLayerRequest({
                domainName: domain,
                startTime: window.startTime,
                endTime: window.endTime,
                ispNameEn: "all",
                locationNameEn,
                layer: "all",
              }),
            )
          : client.describeDomainUsageData(
              new DescribeDomainUsageDataRequest({
                regionId,
                domainName: domain,
                startTime: window.startTime,
                endTime: window.endTime,
                field: "bps",
                type: "all",
                area,
                dataProtocol: "all",
                interval: window.interval,
              }),
            ),
      ),
      withAliyunRetry("pvUv", requestDebug, () =>
        client.describeLiveDomainPvUvData(
          new DescribeLiveDomainPvUvDataRequest({
            regionId,
            domainName: domain,
            startTime: window.startTime,
            endTime: window.endTime,
          }),
        ),
      ),
      shouldFetchRegionalTraffic
        ? fetchRegionalTrafficSummaries(
            client,
            domain,
            window.startTime,
            window.endTime,
            window.interval,
            regionId,
            locale,
            requestDebug,
          )
        : Promise.resolve([] as RegionalTrafficSummary[]),
    ]);

    const trafficPointsMap = new Map<string, AnalyticsPoint>();
    const bandwidthPointsMap = new Map<string, AnalyticsPoint>();
    const pvUvPointsMap = new Map<string, AnalyticsPoint>();

    const trafficModules = useLocationFilter
      ? trafficResponse.body?.trafficDataPerInterval?.dataModule ?? []
      : trafficResponse.body?.usageDataPerInterval?.dataModule ?? [];

    for (const dataPoint of trafficModules) {
      const timestamp = dataPoint.timeStamp ?? "";

      if (!timestamp) {
        continue;
      }

      trafficPointsMap.set(timestamp, {
        timestamp,
        trafficBytes: parseNumericValue("trafficValue" in dataPoint ? dataPoint.trafficValue : dataPoint.value),
        bps: 0,
        pv: 0,
        uv: 0,
      });
    }

    const bandwidthModules = useLocationFilter
      ? bandwidthResponse.body?.bpsDataInterval?.dataModule ?? []
      : bandwidthResponse.body?.usageDataPerInterval?.dataModule ?? [];

    for (const dataPoint of bandwidthModules) {
      const timestamp = dataPoint.timeStamp ?? "";

      if (!timestamp) {
        continue;
      }

      const current = bandwidthPointsMap.get(timestamp) ?? {
        timestamp,
        trafficBytes: 0,
        bps: 0,
        pv: 0,
        uv: 0,
      };

      current.bps = parseNumericValue(dataPoint.value);
      bandwidthPointsMap.set(timestamp, current);
    }

    for (const point of pvUvResponse.body?.pvUvDataInfos?.pvUvDataInfo ?? []) {
      const timestamp = point.timeStamp ?? "";

      if (!timestamp) {
        continue;
      }

      const current = pvUvPointsMap.get(timestamp) ?? {
        timestamp,
        trafficBytes: 0,
        bps: 0,
        pv: 0,
        uv: 0,
      };

      current.pv = parseNumericValue(point.PV);
      current.uv = parseNumericValue(point.UV);
      pvUvPointsMap.set(timestamp, current);
    }

    const trafficPoints = sortAnalyticsPoints(Array.from(trafficPointsMap.values()));
    const bandwidthPoints = sortAnalyticsPoints(Array.from(bandwidthPointsMap.values()));
    const pvUvPoints = sortAnalyticsPoints(Array.from(pvUvPointsMap.values()));
    const trafficIntervalSeconds = inferIntervalSeconds(trafficPoints, Number(window.interval));
    const bandwidthIntervalSeconds = inferIntervalSeconds(bandwidthPoints, Number(window.interval));
    const pvUvIntervalSeconds =
      parseNumericValue(pvUvResponse.body?.dataInterval) || inferIntervalSeconds(pvUvPoints, 3600);
    const mergedPointCount = new Set([
      ...trafficPoints.map((point) => point.timestamp),
      ...bandwidthPoints.map((point) => point.timestamp),
      ...pvUvPoints.map((point) => point.timestamp),
    ]).size;

    console.info(
      `Alibaba Cloud Live API request finished ${stringifyDebugPayload({
        ...requestDebug,
        traffic: summarizeModules(trafficModules),
        bandwidth: summarizeModules(bandwidthModules),
        pvUv: {
          dataInterval: pvUvResponse.body?.dataInterval ?? null,
          count: (pvUvResponse.body?.pvUvDataInfos?.pvUvDataInfo ?? []).length,
          sample: (pvUvResponse.body?.pvUvDataInfos?.pvUvDataInfo ?? []).slice(0, 3).map((point) => ({
            timeStamp: point.timeStamp,
            PV: point.PV,
            UV: point.UV,
          })),
        },
        trafficIntervalSeconds,
        bandwidthIntervalSeconds,
        pvUvIntervalSeconds,
        regionalTraffic: regionalTrafficSummaries.map((item) => ({
          code: item.code,
          trafficBytes: item.trafficBytes,
        })),
        mergedPointCount,
      })}`,
    );

    if (mergedPointCount === 0) {
      console.warn(
        `Alibaba Cloud Live API returned no merged points ${stringifyDebugPayload(requestDebug)}`,
      );
      return {
        data: null,
        reason: "empty",
      };
    }

    return {
      data: normalizeAnalytics(
        locale,
        window.fromDisplay,
        window.toDisplay,
        filters.timeZoneOffsetMinutes ?? 8 * 60,
        trafficPoints,
        trafficIntervalSeconds,
        bandwidthPoints,
        bandwidthIntervalSeconds,
        pvUvPoints,
        pvUvIntervalSeconds,
        regionalTrafficSummaries,
      ),
      reason: null,
    };
  } catch (error) {
    const errorPayload = stringifyDebugPayload({
      ...requestDebug,
      error: simplifyError(error),
    });

    if (isAliyunDomainNotFoundError(error)) {
      console.warn(`Alibaba Cloud Live API domain not found ${errorPayload}`);
      return {
        data: null,
        reason: "domain_not_found",
      };
    }

    console.error(`Alibaba Cloud Live API request failed ${errorPayload}`);
    return {
      data: null,
      reason: "request_failed",
    };
  }
}

export async function fetchLiveDomainTrafficSummaryResult(
  domain: string,
  filters: ReportFilters,
): Promise<LiveDomainTrafficSummaryResult> {
  const client = getAliyunLiveClient();

  if (!client || !domain) {
    return {
      data: null,
      reason: "request_failed",
    };
  }

  const window = resolveReportWindow(filters);
  const regionId = getEnv("ALIYUN_LIVE_REGION_ID") || "cn-shanghai";
  const endpoint = getAliyunLiveEndpoint();
  const area = mapReportAreaToAliyunArea(filters.area);
  const locationNameEn = getAliyunLocationNameEn(filters);
  const useLocationFilter = Boolean(locationNameEn);
  const requestDebug = {
    domain,
    regionId,
    endpoint,
    area: area ?? null,
    locationNameEn: locationNameEn ?? null,
    queryType: filters.queryType ?? "traffic",
    timeRange: filters.timeRange,
    timeZone: filters.timeZone ?? null,
    timeZoneOffsetMinutes: filters.timeZoneOffsetMinutes ?? null,
    startTime: window.startTime,
    endTime: window.endTime,
    interval: window.interval,
  };

  console.info(`Alibaba Cloud Live traffic-only request started ${stringifyDebugPayload(requestDebug)}`);

  try {
    const response = await withAliyunRetry("traffic-only", requestDebug, () =>
      useLocationFilter
        ? client.describeLiveDomainTrafficData(
            new DescribeLiveDomainTrafficDataRequest({
              domainName: domain,
              startTime: window.startTime,
              endTime: window.endTime,
              ispNameEn: "all",
              locationNameEn,
            }),
          )
        : client.describeDomainUsageData(
            new DescribeDomainUsageDataRequest({
              regionId,
              domainName: domain,
              startTime: window.startTime,
              endTime: window.endTime,
              field: "traf",
              type: "all",
              area,
              dataProtocol: "all",
              interval: window.interval,
            }),
          ),
    );

    const trafficModules = useLocationFilter
      ? response.body?.trafficDataPerInterval?.dataModule ?? []
      : response.body?.usageDataPerInterval?.dataModule ?? [];

    const trafficPoints: Array<{ timestamp: string; trafficBytes: number }> = [];

    for (const dataPoint of trafficModules) {
      const timestamp = dataPoint.timeStamp ?? "";

      if (!timestamp) {
        continue;
      }

      trafficPoints.push({
        timestamp,
        trafficBytes: parseNumericValue("trafficValue" in dataPoint ? dataPoint.trafficValue : dataPoint.value),
      });
    }

    console.info(
      `Alibaba Cloud Live traffic-only request finished ${stringifyDebugPayload({
        ...requestDebug,
        traffic: summarizeModules(trafficModules),
        pointCount: trafficPoints.length,
      })}`,
    );

    if (trafficPoints.length === 0) {
      console.warn(
        `Alibaba Cloud Live traffic-only request returned no points ${stringifyDebugPayload(requestDebug)}`,
      );
      return {
        data: null,
        reason: "empty",
      };
    }

    const totalTrafficBytes = trafficPoints.reduce((sum, point) => sum + point.trafficBytes, 0);

    return {
      data: {
        totalTrafficGb: Number((totalTrafficBytes / 1024 ** 3).toFixed(2)),
      },
      reason: null,
    };
  } catch (error) {
    const errorPayload = stringifyDebugPayload({
      ...requestDebug,
      error: simplifyError(error),
    });

    if (isAliyunDomainNotFoundError(error)) {
      console.warn(`Alibaba Cloud Live traffic-only domain not found ${errorPayload}`);
      return {
        data: null,
        reason: "domain_not_found",
      };
    }

    console.error(`Alibaba Cloud Live traffic-only request failed ${errorPayload}`);
    return {
      data: null,
      reason: "request_failed",
    };
  }
}

export async function fetchLiveDomainReport(
  domain: string,
  filters: ReportFilters,
  locale: Locale,
): Promise<LiveDomainReportData | null> {
  const result = await fetchLiveDomainReportResult(domain, filters, locale);
  return result.data;
}
