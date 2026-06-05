export type Metric = {
  label: string;
  value: string;
  delta: string;
  tone: "brand" | "success" | "warning";
};

export type SeriesPoint = {
  label: string;
  value: number;
  tooltipLabel?: string;
};

export type DualSeriesPoint = {
  label: string;
  primary: number;
  secondary: number;
  tooltipLabel?: string;
};

export type ActivityItem = {
  title: string;
  meta: string;
  tag: string;
};

export type TableRow = {
  period: string;
  traffic: string;
  pv: string;
  uv: string;
  peakBps: string;
};

export type RegionTrafficRow = {
  regionCode: string;
  region: string;
  traffic: string;
  share: string;
  unitPrice: string;
  cost: string;
};

import { Locale } from "@/lib/i18n";

export const adminTrafficTrend: SeriesPoint[] = [
  { label: "05-25", value: 8.1 },
  { label: "05-26", value: 8.6 },
  { label: "05-27", value: 9.4 },
  { label: "05-28", value: 10.2 },
  { label: "05-29", value: 11.8 },
  { label: "05-30", value: 10.9 },
  { label: "05-31", value: 12.6 },
];

export const clientPvUvTrend: DualSeriesPoint[] = [
  { label: "00:00", primary: 410, secondary: 92 },
  { label: "04:00", primary: 560, secondary: 118 },
  { label: "08:00", primary: 1220, secondary: 246 },
  { label: "12:00", primary: 1840, secondary: 388 },
  { label: "16:00", primary: 2380, secondary: 492 },
  { label: "20:00", primary: 2860, secondary: 536 },
  { label: "24:00", primary: 1980, secondary: 420 },
];

export const clientTrafficTrend: SeriesPoint[] = [
  { label: "05-26", value: 214 },
  { label: "05-27", value: 232 },
  { label: "05-28", value: 205 },
  { label: "05-29", value: 244 },
  { label: "05-30", value: 259 },
  { label: "05-31", value: 271 },
  { label: "06-01", value: 286 },
];

export const clientPeakBandwidth: SeriesPoint[] = [
  { label: "00", value: 82 },
  { label: "04", value: 96 },
  { label: "08", value: 122 },
  { label: "12", value: 164 },
  { label: "16", value: 218 },
  { label: "20", value: 246 },
  { label: "24", value: 173 },
];

export const clientUsageTable: TableRow[] = [
  { period: "2026-06-01 00:00", traffic: "28.2 GB", pv: "14,220", uv: "1,280", peakBps: "92 Mbps" },
  { period: "2026-06-01 04:00", traffic: "31.8 GB", pv: "19,360", uv: "1,840", peakBps: "108 Mbps" },
  { period: "2026-06-01 08:00", traffic: "42.6 GB", pv: "27,410", uv: "2,340", peakBps: "154 Mbps" },
  { period: "2026-06-01 12:00", traffic: "55.4 GB", pv: "34,950", uv: "2,980", peakBps: "184 Mbps" },
  { period: "2026-06-01 16:00", traffic: "61.9 GB", pv: "39,620", uv: "3,140", peakBps: "218 Mbps" },
  { period: "2026-06-01 20:00", traffic: "66.5 GB", pv: "48,670", uv: "3,262", peakBps: "246 Mbps" },
];

export function getClientMetricTemplates(locale: Locale): Metric[] {
  if (locale === "en") {
    return [
      { label: "Today Traffic", value: "286.4 GB", delta: "+9.1% vs yesterday", tone: "brand" },
      { label: "Monthly Traffic", value: "7.83 TB", delta: "Synced at 06-01 13:00", tone: "success" },
      { label: "Today UV", value: "12,842", delta: "+14.6% active growth", tone: "warning" },
      { label: "Today PV", value: "184,230", delta: "Playback requests stable", tone: "brand" },
    ];
  }

  return [
    { label: "今日下行流量", value: "286.4 GB", delta: "+9.1% 比昨日", tone: "brand" },
    { label: "本月累计流量", value: "7.83 TB", delta: "已同步到 06-01 13:00", tone: "success" },
    { label: "今日 UV", value: "12,842", delta: "+14.6% 活跃提升", tone: "warning" },
    { label: "今日 PV", value: "184,230", delta: "播放请求稳定", tone: "brand" },
  ];
}

export function getClientHighlightTemplates(locale: Locale): ActivityItem[] {
  if (locale === "en") {
    return [
      { title: "Primary Streaming Domain", meta: "live.sportliveapi.com", tag: "Bound Domain" },
      { title: "Today's Peak Bandwidth", meta: "246 Mbps @ 20:00", tag: "Peak Bandwidth" },
      { title: "UV Definition", meta: "Platform deduplicated visitors", tag: "Data Notes" },
      { title: "Sync Status", meta: "Alibaba Cloud data delay is about 5-15 minutes", tag: "Freshness" },
    ];
  }

  return [
    { title: "主播放域名", meta: "live.sportliveapi.com", tag: "绑定域名" },
    { title: "今日峰值带宽", meta: "246 Mbps @ 20:00", tag: "带宽峰值" },
    { title: "UV 统计口径", meta: "平台去重访客", tag: "数据说明" },
    { title: "同步状态", meta: "阿里云数据延迟约 5-15 分钟", tag: "实时性" },
  ];
}

export function getAdminActivities(locale: Locale): ActivityItem[] {
  if (locale === "en") {
    return [
      { title: "New customer Beijing Sports Media has been activated", meta: "2 minutes ago", tag: "Customer Opened" },
      { title: "sportlive-hk-01.com was rebound to Asia Premier", meta: "18 minutes ago", tag: "Domain Assignment" },
      { title: "Customer F1 Edge reset access auth", meta: "42 minutes ago", tag: "Security Action" },
      { title: "The system finished archiving May usage", meta: "Today 04:00", tag: "Scheduled Task" },
    ];
  }

  return [
    { title: "新客户 Beijing Sports Media 已开通", meta: "2 分钟前", tag: "客户开通" },
    { title: "sportlive-hk-01.com 重新绑定至 Asia Premier", meta: "18 分钟前", tag: "域名分配" },
    { title: "客户 F1 Edge 重置访问 Auth", meta: "42 分钟前", tag: "安全动作" },
    { title: "系统完成 05 月用量归档", meta: "今天 04:00", tag: "定时任务" },
  ];
}
