"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DataTable, MetricCard, Panel } from "@/components/dashboard-ui";
import type {
  TrafficBoardPeriod,
  TrafficBoardRow,
  TrafficBoardShellView,
} from "@/lib/mock-backend";
import { getStatusLabel, getTranslations, type Locale } from "@/lib/i18n";

function getStatusTone(status: "正常" | "待审查" | "停用") {
  if (status === "正常") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "停用") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

type TrafficBoardRowState = TrafficBoardRow & {
  loading: boolean;
  loaded: boolean;
};

type TrafficSortDirection = "desc" | "asc";

function buildTrafficBoardTraceId(customerId: string, period: TrafficBoardPeriod) {
  return `tb-${period}-${customerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stringifyTrafficBoardClientLog(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function shouldFetchTraffic(row: Pick<TrafficBoardRow, "status" | "domainCount">) {
  return row.status === "正常" && row.domainCount > 0;
}

function shouldShowGiftTrafficMetrics(period: TrafficBoardPeriod) {
  return period === "cycle" || period === "lastCycle";
}

function shouldShowGiftTrafficProjection(period: TrafficBoardPeriod) {
  return period === "cycle" || period === "lastCycle";
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

function formatTrafficAllowanceFromGb(valueGb: number, locale: Locale) {
  return `${(valueGb / 1024).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} TB`;
}

function formatTrafficMarkupLabel(value: number, locale: Locale) {
  const displayValue = value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
  return locale === "en" ? `Includes ${displayValue}% markup` : `已含 ${displayValue}% 上浮`;
}

function getRetryTrafficLabel(locale: Locale) {
  return locale === "en" ? "Retry" : "重试";
}

export function AdminTrafficBoard({
  locale,
  view,
  canViewTrafficMarkup,
}: {
  locale: Locale;
  view: TrafficBoardShellView;
  canViewTrafficMarkup: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = getTranslations(locale);
  const periods: TrafficBoardPeriod[] = [
    "cycle",
    "lastCycle",
    "today",
    "last24",
    "last3",
    "last30",
    "currentMonth",
    "lastMonth",
  ];
  const initialRows = useMemo<TrafficBoardRowState[]>(
    () =>
      view.rows.map((row) => ({
        ...row,
        loading: shouldFetchTraffic(row),
        loaded: !shouldFetchTraffic(row),
      })),
    [view.rows],
  );
  const [rows, setRows] = useState<TrafficBoardRowState[]>(initialRows);
  const [trafficSortDirection, setTrafficSortDirection] = useState<TrafficSortDirection>("desc");

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  function toggleTrafficSortDirection() {
    setTrafficSortDirection((currentDirection) => (currentDirection === "desc" ? "asc" : "desc"));
  }

  const requestRowTraffic = useCallback(
    async (
      row: Pick<TrafficBoardRowState, "customerId" | "customerName" | "domainCount">,
      isCancelled?: () => boolean,
    ) => {
      const traceId = buildTrafficBoardTraceId(row.customerId, view.period);
      const startedAt = Date.now();

      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow.customerId === row.customerId
            ? {
                ...currentRow,
                loading: true,
                loaded: false,
                canRetry: false,
              }
            : currentRow,
        ),
      );

      console.info(
        `Traffic board row client request started ${stringifyTrafficBoardClientLog({
          traceId,
          customerId: row.customerId,
          customerName: row.customerName,
          period: view.period,
          domainCount: row.domainCount,
        })}`,
      );

      try {
        const response = await fetch(
          `/api/dashboard/admin/traffic-board-row?customerId=${encodeURIComponent(
            row.customerId,
          )}&period=${encodeURIComponent(view.period)}&traceId=${encodeURIComponent(traceId)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();

        if (isCancelled?.()) {
          return;
        }

        if (!response.ok) {
          throw new Error(typeof payload?.message === "string" ? payload.message : "TRAFFIC_BOARD_ROW_FAILED");
        }

        console.info(
          `Traffic board row client request finished ${stringifyTrafficBoardClientLog({
            traceId,
            customerId: row.customerId,
            customerName: row.customerName,
            period: view.period,
            hasLiveData: payload?.hasLiveData ?? false,
            traffic: payload?.traffic ?? "--",
            trafficGb: payload?.trafficGb ?? 0,
            trafficHint: payload?.trafficHint ?? null,
            durationMs: Date.now() - startedAt,
          })}`,
        );

        setRows((currentRows) =>
          currentRows.map((currentRow) =>
            currentRow.customerId === row.customerId
              ? {
                  ...currentRow,
                  ...payload,
                  loading: false,
                  loaded: true,
                }
              : currentRow,
          ),
        );
      } catch {
        if (isCancelled?.()) {
          return;
        }

        console.error(
          `Traffic board row client request failed ${stringifyTrafficBoardClientLog({
            traceId,
            customerId: row.customerId,
            customerName: row.customerName,
            period: view.period,
            durationMs: Date.now() - startedAt,
          })}`,
        );

        setRows((currentRows) =>
          currentRows.map((currentRow) =>
            currentRow.customerId === row.customerId
              ? {
                  ...currentRow,
                  traffic: "--",
                  hasLiveData: false,
                  trafficGb: 0,
                  trafficHint:
                    locale === "en"
                      ? "Alibaba Cloud query failed"
                      : "阿里云查询失败，请稍后重试",
                  canRetry: true,
                  loading: false,
                  loaded: true,
                }
              : currentRow,
          ),
        );
      }
    },
    [locale, view.period],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRowsSequentially() {
      for (const row of view.rows) {
        if (!shouldFetchTraffic(row)) {
          continue;
        }
        await requestRowTraffic(row, () => cancelled);
      }
    }

    void loadRowsSequentially();

    return () => {
      cancelled = true;
    };
  }, [requestRowTraffic, view.rows]);

  function buildPeriodHref(period: TrafficBoardPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    return `${pathname}?${params.toString()}`;
  }

  const requestableCount = rows.filter((row) => shouldFetchTraffic(row)).length;
  const resolvedCount = rows.filter((row) => shouldFetchTraffic(row) && row.loaded).length;
  const totalTrafficGb = rows.reduce((sum, row) => sum + row.trafficGb, 0);
  const liveCustomerCount = rows.filter((row) => row.hasLiveData).length;
  const showGiftTrafficMetrics = shouldShowGiftTrafficMetrics(view.period);
  const showGiftTrafficProjection = shouldShowGiftTrafficProjection(view.period);
  const hasGiftTrafficCustomers = showGiftTrafficMetrics && rows.some((row) => Boolean(row.monthlyGiftTrafficGb));
  const projectedTrafficLabel =
    view.period === "cycle" || view.period === "lastCycle"
      ? locale === "en"
        ? "Cycle Projection"
        : "账期预估"
      : t.trafficBoard.projectedMonthTraffic;
  const sortedRows = useMemo(() => {
    const getRowBucket = (row: TrafficBoardRowState) => {
      if (row.hasLiveData) {
        return 0;
      }

      if (row.loading) {
        return 1;
      }

      return 2;
    };

    return [...rows].sort((left, right) => {
      const bucketDifference = getRowBucket(left) - getRowBucket(right);

      if (bucketDifference !== 0) {
        return bucketDifference;
      }

      if (left.hasLiveData && right.hasLiveData && left.trafficGb !== right.trafficGb) {
        return trafficSortDirection === "desc" ? right.trafficGb - left.trafficGb : left.trafficGb - right.trafficGb;
      }

      return left.customerName.localeCompare(right.customerName);
    });
  }, [rows, trafficSortDirection]);
  const metrics = [
    {
      label: locale === "en" ? "Managed Customers" : "归属客户",
      value: String(view.summary.customerCount),
      delta: locale === "en" ? "Current visible scope" : "当前可见范围",
      tone: "brand" as const,
    },
    {
      label: view.trafficLabel,
      value: resolvedCount > 0 ? formatTrafficFromGb(totalTrafficGb, locale) : "--",
      delta:
        requestableCount > 0
          ? locale === "en"
            ? `Loaded ${resolvedCount}/${requestableCount} customers`
            : `已完成 ${resolvedCount}/${requestableCount} 个客户查询`
          : locale === "en"
            ? "No active traffic queries"
            : "当前没有可查询的流量数据",
      tone: "success" as const,
    },
    {
      label: locale === "en" ? "Customers With Data" : "有数据客户",
      value: resolvedCount > 0 ? String(liveCustomerCount) : "--",
      delta:
        requestableCount > 0
          ? locale === "en"
            ? `Loaded ${resolvedCount}/${requestableCount} customers`
            : `已完成 ${resolvedCount}/${requestableCount} 个客户查询`
          : locale === "en"
            ? "Alibaba Cloud traffic unavailable"
            : "暂无可查询的阿里云流量",
      tone: "warning" as const,
    },
    {
      label: locale === "en" ? "Renewing Soon" : "近 3 天续费",
      value: String(view.summary.dueSoonCount),
      delta: locale === "en" ? "Within the next 3 days" : "便于及时提醒充值",
      tone: "brand" as const,
    },
  ];

  return (
    <div className="space-y-3">
      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} compact {...metric} />
        ))}
      </section>

      <Panel
        compact
        title={t.adminTrafficBoardPage.tableTitle}
        aside={
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <div className="flex max-w-[720px] flex-wrap gap-1.5 sm:justify-end">
              {periods.map((period) => {
                const active = period === view.period;
                return (
                  <Link
                    key={period}
                    href={buildPeriodHref(period)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium leading-none transition ${
                      active
                        ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                    }`}
                  >
                    {t.trafficBoard.periods[period]}
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 sm:justify-end">
              <p>{view.cycleHint}</p>
              <p>{t.adminTrafficBoardPage.generatedAt(view.generatedAt)}</p>
            </div>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-base font-semibold text-slate-950">{t.trafficBoard.emptyTitle}</p>
            <p className="mt-2 text-sm text-slate-500">{t.trafficBoard.emptyDescription}</p>
          </div>
        ) : (
          <DataTable
            compact
            headers={[
              t.trafficBoard.customer,
              t.trafficBoard.renewalDay,
              t.trafficBoard.cycleRange,
              t.trafficBoard.domains,
              <button
                key="traffic-sort-header"
                type="button"
                onClick={toggleTrafficSortDirection}
                className="inline-flex items-center gap-1 text-left font-medium leading-none text-slate-700 transition hover:text-slate-950"
              >
                <span>{view.trafficLabel}</span>
                <span className="text-slate-400">{trafficSortDirection === "desc" ? "↓" : "↑"}</span>
              </button>,
              ...(hasGiftTrafficCustomers
                ? [
                    t.trafficBoard.monthlyGiftTrafficGb,
                    t.trafficBoard.giftUsageRate,
                    ...(showGiftTrafficProjection ? [projectedTrafficLabel] : []),
                  ]
                : []),
              t.trafficBoard.action,
            ]}
            rows={sortedRows.map((row) => {
              const cells = [
                <div key={`${row.customerId}-customer`} className="min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-950">{row.customerName}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${getStatusTone(
                        row.status,
                      )}`}
                    >
                      {getStatusLabel(row.status, locale)}
                    </span>
                  </div>
                </div>,
                <span key={`${row.customerId}-renewal`} className="whitespace-nowrap text-slate-600">
                  {row.renewalDayDisplay}
                </span>,
                <span key={`${row.customerId}-range`} className="whitespace-nowrap text-slate-600">
                  {row.cycleRange}
                </span>,
                <span key={`${row.customerId}-domains`} className="whitespace-nowrap text-slate-600">
                  {row.domainCount}
                </span>,
                <div key={`${row.customerId}-traffic`} className="min-w-[160px]">
                  {row.loading ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                      <span className="text-xs text-slate-500">{t.adminTrafficBoardPage.loadingTitle}</span>
                    </div>
                  ) : (
                    <span className="whitespace-nowrap font-medium text-slate-950">
                      {row.hasLiveData ? row.traffic : t.trafficBoard.noData}
                    </span>
                  )}
                  {row.trafficHint ? (
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{row.trafficHint}</p>
                  ) : null}
                  {row.canRetry && !row.loading ? (
                    <button
                      type="button"
                      onClick={() => void requestRowTraffic(row)}
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium leading-none text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                    >
                      <span aria-hidden="true">↻</span>
                      <span>{getRetryTrafficLabel(locale)}</span>
                    </button>
                  ) : null}
                  {canViewTrafficMarkup && row.hasLiveData && row.trafficMarkupPercent ? (
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">
                      {formatTrafficMarkupLabel(row.trafficMarkupPercent, locale)}
                    </p>
                  ) : null}
                </div>,
              ];

              if (hasGiftTrafficCustomers) {
                cells.push(
                  <span key={`${row.customerId}-gift-traffic`} className="whitespace-nowrap text-slate-600">
                    {row.monthlyGiftTrafficGb ? formatTrafficAllowanceFromGb(row.monthlyGiftTrafficGb, locale) : "--"}
                  </span>,
                  <span key={`${row.customerId}-gift-usage`} className="whitespace-nowrap text-slate-600">
                    {row.giftUsageRate ?? "--"}
                  </span>,
                );

                if (showGiftTrafficProjection) {
                  cells.push(
                    <span key={`${row.customerId}-projected`} className="whitespace-nowrap text-slate-600">
                      {row.projectedMonthTraffic ?? "--"}
                    </span>,
                  );
                }
              }

              cells.push(
                <Link
                  key={`${row.customerId}-action`}
                  href={row.reportHref}
                  className="inline-flex whitespace-nowrap rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium leading-none text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                >
                  {t.trafficBoard.openReport}
                </Link>,
              );

              return cells;
            })}
          />
        )}
      </Panel>
    </div>
  );
}
