"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardModal, DataTable, MetricCard, Panel } from "@/components/dashboard-ui";
import type {
  TrafficBoardPeriod,
  TrafficBoardCycleHistoryView,
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

function shouldShowGiftTrafficProjection(period: TrafficBoardPeriod) {
  return period === "cycle" || period === "lastCycle";
}

function isNewCustomerGiftPeriod(period: TrafficBoardPeriod) {
  return period === "newCustomerGift";
}

function isCycleWaiverPeriod(period: TrafficBoardPeriod) {
  return period === "cycleWaiver";
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

function formatUsdValue(valueUsd: number, locale: Locale) {
  return `${valueUsd.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} USD`;
}

function formatTrafficMarkupSuffix(value: number, locale: Locale) {
  const displayValue = value.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
  return `(+${displayValue}%)`;
}

function getRetryTrafficLabel(locale: Locale) {
  return locale === "en" ? "Manual Refresh" : "手动更新";
}

export function AdminTrafficBoard({
  locale,
  view,
  canViewTrafficMarkup,
  availablePeriods,
  tableTitle,
}: {
  locale: Locale;
  view: TrafficBoardShellView;
  canViewTrafficMarkup: boolean;
  availablePeriods: TrafficBoardPeriod[];
  tableTitle?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = getTranslations(locale);
  const periods = availablePeriods;
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
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<TrafficBoardRowState | null>(null);
  const [cycleHistory, setCycleHistory] = useState<TrafficBoardCycleHistoryView | null>(null);
  const [cycleHistoryLoading, setCycleHistoryLoading] = useState(false);
  const [cycleHistoryError, setCycleHistoryError] = useState<string | null>(null);
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());
  const requestGenerationRef = useRef(0);

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
            trafficCost: payload?.trafficCost ?? null,
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
                  trafficCost: null,
                  trafficCostUsd: 0,
                  trafficCostCanRetry: true,
                  cycleOverspend: null,
                  cycleOverspendUsd: 0,
                  remainingBalance: null,
                  remainingBalanceUsd: 0,
                  pendingTopUp: null,
                  pendingTopUpUsd: 0,
                  projectedMonthTraffic: null,
                  projectedTrafficCost: null,
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

  const enqueueRowTraffic = useCallback(
    (row: Pick<TrafficBoardRowState, "customerId" | "customerName" | "domainCount">) => {
      const generation = requestGenerationRef.current;
      requestQueueRef.current = requestQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== requestGenerationRef.current) {
            return;
          }

          await requestRowTraffic(row, () => generation !== requestGenerationRef.current);
        });

      return requestQueueRef.current;
    },
    [requestRowTraffic],
  );

  useEffect(() => {
    requestGenerationRef.current += 1;
    const generation = requestGenerationRef.current;
    requestQueueRef.current = Promise.resolve();

    for (const row of view.rows) {
      if (!shouldFetchTraffic(row)) {
        continue;
      }

      requestQueueRef.current = requestQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== requestGenerationRef.current) {
            return;
          }

          await requestRowTraffic(row, () => generation !== requestGenerationRef.current);
        });
    }

    return () => {
      requestGenerationRef.current += 1;
      requestQueueRef.current = Promise.resolve();
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
  const totalTrafficCostUsd = rows.reduce((sum, row) => sum + row.trafficCostUsd, 0);
  const liveCustomerCount = rows.filter((row) => row.hasLiveData).length;
  const showGiftTrafficProjection = shouldShowGiftTrafficProjection(view.period);
  const showNewCustomerGiftView = isNewCustomerGiftPeriod(view.period);
  const showCycleWaiverView = isCycleWaiverPeriod(view.period);
  const totalAvailableRechargeUsd = rows.reduce((sum, row) => sum + row.availableRechargeUsd, 0);
  const totalRechargeUsd = rows.reduce((sum, row) => sum + row.cumulativeRechargeUsd, 0);
  const totalRemainingBalanceUsd = rows.reduce((sum, row) => sum + row.remainingBalanceUsd, 0);
  const totalPendingTopUpUsd = rows.reduce((sum, row) => sum + row.pendingTopUpUsd, 0);
  const projectedTrafficLabel =
    view.period === "cycle" || view.period === "lastCycle"
      ? locale === "en"
        ? "Cycle Projection"
        : "账期预估"
      : t.trafficBoard.projectedMonthTraffic;
  const tableColumnClassNames = showCycleWaiverView
    ? ["w-[14%]", "w-[14%]", "w-[16%]", "w-[12%]", "w-[12%]", "w-[12%]", "w-[10%]", "w-[10%] text-center"]
    : showNewCustomerGiftView
    ? ["w-[15%]", "w-[15%]", "w-[18%]", "w-[14%]", "w-[13%]", "w-[13%]", "w-[12%] text-center"]
    : showGiftTrafficProjection
    ? [
        "w-[15%]",
        "w-[15%]",
        "w-[16%]",
        "w-[15%]",
        "w-[12%]",
        "w-[12%]",
        "w-[15%] text-center",
      ]
    : ["w-[20%]", "w-[20%]", "w-[30%]", "w-[30%] text-center"];
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

      if (
        showCycleWaiverView &&
        left.hasLiveData &&
        right.hasLiveData &&
        left.pendingTopUpUsd !== right.pendingTopUpUsd
      ) {
        return right.pendingTopUpUsd - left.pendingTopUpUsd;
      }

      if (
        showNewCustomerGiftView &&
        left.hasLiveData &&
        right.hasLiveData &&
        left.remainingBalanceUsd !== right.remainingBalanceUsd
      ) {
        return left.remainingBalanceUsd - right.remainingBalanceUsd;
      }

      if (left.hasLiveData && right.hasLiveData && left.trafficGb !== right.trafficGb) {
        return trafficSortDirection === "desc" ? right.trafficGb - left.trafficGb : left.trafficGb - right.trafficGb;
      }

      return left.customerName.localeCompare(right.customerName);
    });
  }, [rows, showCycleWaiverView, showNewCustomerGiftView, trafficSortDirection]);
  const metrics = showCycleWaiverView
    ? [
        {
          label: locale === "en" ? "Waiver Customers" : "获免客户",
          value: String(view.summary.customerCount),
          delta: locale === "en" ? "Customers with cycle waiver credit" : "仅展示设置了账期获免的客户",
          tone: "brand" as const,
        },
        {
          label: view.trafficLabel,
          value: resolvedCount > 0 ? formatTrafficFromGb(totalTrafficGb, locale) : "--",
          delta: locale === "en" ? "Current cycle actual traffic" : "当前账期实际流量",
          tone: "success" as const,
        },
        {
          label: t.adminTrafficBoardPage.totalTrafficCost,
          value: resolvedCount > 0 ? formatUsdValue(totalTrafficCostUsd, locale) : "--",
          delta: locale === "en" ? "Current cycle actual cost" : "当前账期实际金额",
          tone: "warning" as const,
        },
        {
          label: locale === "en" ? "Available Recharge" : "可用充值",
          value: formatUsdValue(totalAvailableRechargeUsd, locale),
          delta:
            locale === "en"
              ? "Manual available recharge balance"
              : "客户管理里手工维护的可用余额",
          tone: "brand" as const,
        },
        {
          label: locale === "en" ? "Top-up Needed" : "待补金额",
          value: resolvedCount > 0 ? formatUsdValue(totalPendingTopUpUsd, locale) : "--",
          delta: locale === "en" ? "Current cycle amount still unpaid" : "当前账期扣除可用充值后仍需补款",
          tone: totalPendingTopUpUsd > 0 ? ("warning" as const) : ("success" as const),
        },
      ]
    : showNewCustomerGiftView
    ? [
        {
          label: locale === "en" ? "Gift Customers" : "赠送客户",
          value: String(view.summary.customerCount),
          delta:
            locale === "en"
              ? "Customers with new-customer gift credit"
              : "仅展示设置了新客赠送的客户",
          tone: "brand" as const,
        },
        {
          label: view.trafficLabel,
          value: resolvedCount > 0 ? formatTrafficFromGb(totalTrafficGb, locale) : "--",
          delta:
            locale === "en"
              ? "From 2026-05-28 until now"
              : "从 2026-05-28 到当前",
          tone: "success" as const,
        },
        {
          label: t.adminTrafficBoardPage.totalTrafficCost,
          value: resolvedCount > 0 ? formatUsdValue(totalTrafficCostUsd, locale) : "--",
          delta: locale === "en" ? "Alibaba Cloud cumulative cost" : "阿里云累计消耗费用",
          tone: "warning" as const,
        },
        {
          label: locale === "en" ? "Cumulative Recharge" : "累计充值",
          value: formatUsdValue(totalRechargeUsd, locale),
          delta:
            locale === "en"
              ? "Manual cumulative recharge amount"
              : "客户管理里手工记录的累计充值金额",
          tone: "brand" as const,
        },
        {
          label: locale === "en" ? "Remaining Available" : "剩余可用",
          value: resolvedCount > 0 ? formatUsdValue(totalRemainingBalanceUsd, locale) : "--",
          delta: locale === "en" ? "Gift + recharge - cost" : "充值 + 赠送 - 消耗",
          tone: "success" as const,
        },
      ]
    : [
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
          label: t.adminTrafficBoardPage.totalTrafficCost,
          value: resolvedCount > 0 ? formatUsdValue(totalTrafficCostUsd, locale) : "--",
          delta:
            requestableCount > 0
              ? locale === "en"
                ? `Loaded ${resolvedCount}/${requestableCount} customers`
                : `已完成 ${resolvedCount}/${requestableCount} 个客户查询`
              : locale === "en"
                ? "No active traffic queries"
                : "当前没有可查询的流量费用",
          tone: "warning" as const,
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

  const loadCycleHistory = useCallback(
    async (row: TrafficBoardRowState) => {
      setSelectedHistoryCustomer(row);
      setCycleHistory(null);
      setCycleHistoryError(null);
      setCycleHistoryLoading(true);

      try {
        const response = await fetch(
          `/api/dashboard/admin/traffic-board-cycle-history?customerId=${encodeURIComponent(row.customerId)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(typeof payload?.message === "string" ? payload.message : "TRAFFIC_BOARD_CYCLE_HISTORY_FAILED");
        }

        setCycleHistory(payload);
      } catch {
        setCycleHistoryError(t.trafficBoard.loadHistoryFailed);
      } finally {
        setCycleHistoryLoading(false);
      }
    },
    [t.trafficBoard.loadHistoryFailed],
  );

  const closeCycleHistory = useCallback(() => {
    setSelectedHistoryCustomer(null);
    setCycleHistory(null);
    setCycleHistoryError(null);
    setCycleHistoryLoading(false);
  }, []);

  return (
    <div className="space-y-3">
      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} compact {...metric} />
        ))}
      </section>

      <Panel
        compact
        title={tableTitle ?? t.adminTrafficBoardPage.tableTitle}
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
            fitToContainer
            columnClassNames={tableColumnClassNames}
            headers={[
              t.trafficBoard.customer,
              t.trafficBoard.cycleRange,
              <button
                key="traffic-sort-header"
                type="button"
                onClick={toggleTrafficSortDirection}
                className="inline-flex items-center gap-1 text-left font-medium leading-none text-slate-700 transition hover:text-slate-950"
              >
                <span>{view.trafficLabel}</span>
                <span className="text-slate-400">{trafficSortDirection === "desc" ? "↓" : "↑"}</span>
              </button>,
              ...(showGiftTrafficProjection ? [projectedTrafficLabel] : []),
              ...(showGiftTrafficProjection ? [t.trafficBoard.cycleWaiverTrafficFee] : []),
              ...(showGiftTrafficProjection ? [t.trafficBoard.cycleOverspend] : []),
              ...(showCycleWaiverView ? [t.trafficBoard.cycleWaiverTrafficFee] : []),
              ...(showCycleWaiverView ? [t.trafficBoard.cycleOverspend] : []),
              ...(showCycleWaiverView ? [t.trafficBoard.availableRecharge] : []),
              ...(showCycleWaiverView ? [t.trafficBoard.pendingTopUp] : []),
              ...(showNewCustomerGiftView ? [t.trafficBoard.newCustomerGiftCredit] : []),
              ...(showNewCustomerGiftView ? [t.trafficBoard.cumulativeRecharge] : []),
              ...(showNewCustomerGiftView ? [t.trafficBoard.remainingBalance] : []),
              t.trafficBoard.action,
            ]}
            rows={sortedRows.map((row) => {
              const showInlineRetryButton = !row.loading && (row.canRetry || row.trafficCostCanRetry);
              const renewalDayDisplay =
                canViewTrafficMarkup && row.trafficMarkupPercent
                  ? `${row.renewalDayDisplay}${formatTrafficMarkupSuffix(row.trafficMarkupPercent, locale)}`
                  : row.renewalDayDisplay;
              const cells = [
                <div key={`${row.customerId}-customer`} className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {showCycleWaiverView ? (
                      <button
                        type="button"
                        onClick={() => void loadCycleHistory(row)}
                        className="font-medium text-slate-950 transition hover:text-rose-600"
                      >
                        {row.customerName}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-950">{row.customerName}</span>
                    )}
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${getStatusTone(
                        row.status,
                      )}`}
                    >
                      {getStatusLabel(row.status, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-4 text-slate-500">{renewalDayDisplay}</p>
                </div>,
                <div key={`${row.customerId}-range`} className="min-w-0">
                  <span className="block text-xs leading-5 text-slate-600">{row.cycleRange}</span>
                  <p className="text-xs leading-4 text-slate-500">
                    {locale === "en" ? `Domains: ${row.domainCount}` : `域名：${row.domainCount}`}
                  </p>
                </div>,
                <div key={`${row.customerId}-traffic`} className="min-w-0">
                  {row.loading ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                      <span className="text-xs text-slate-500">{t.adminTrafficBoardPage.loadingTitle}</span>
                    </div>
                  ) : (
                    <span className="block text-sm font-medium leading-5 text-slate-950">
                      {row.hasLiveData ? row.traffic : t.trafficBoard.noData}
                    </span>
                  )}
                  {row.trafficCost ? (
                    <p className="mt-0.5 text-xs font-medium leading-4 text-slate-700">{row.trafficCost}</p>
                  ) : row.trafficCostCanRetry && !row.loading ? (
                    <button
                      type="button"
                      onClick={() => void enqueueRowTraffic(row)}
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium leading-none text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                    >
                      <span aria-hidden="true">↻</span>
                      <span>{getRetryTrafficLabel(locale)}</span>
                    </button>
                  ) : null}
                  {row.trafficHint ? (
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{row.trafficHint}</p>
                  ) : null}
                  {showInlineRetryButton ? (
                    <button
                      type="button"
                      onClick={() => void enqueueRowTraffic(row)}
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium leading-none text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                    >
                      <span aria-hidden="true">↻</span>
                      <span>{getRetryTrafficLabel(locale)}</span>
                    </button>
                  ) : null}
                </div>,
              ];

              if (showGiftTrafficProjection) {
                cells.push(
                  <div key={`${row.customerId}-projected`} className="min-w-0">
                    <span className="block text-sm font-medium leading-5 text-slate-950">
                      {row.projectedMonthTraffic ?? "--"}
                    </span>
                    <p className="mt-0.5 text-xs font-medium leading-4 text-slate-700">
                      {row.projectedTrafficCost ?? "--"}
                    </p>
                  </div>,
                );
              }

              if (showGiftTrafficProjection) {
                cells.push(
                  <span
                    key={`${row.customerId}-cycle-waiver-traffic-fee`}
                    className="block whitespace-nowrap text-sm text-slate-600"
                  >
                    {row.cycleWaiverTrafficFee ?? "--"}
                  </span>,
                );
              }

              if (showGiftTrafficProjection) {
                cells.push(
                  <span
                    key={`${row.customerId}-cycle-overspend`}
                    className={`block whitespace-nowrap text-sm font-medium ${
                      row.trafficCost && row.cycleOverspendUsd > 0 ? "text-rose-600" : "text-slate-600"
                    }`}
                  >
                    {row.trafficCost ? row.cycleOverspend ?? "--" : "--"}
                  </span>,
                );
              }

              if (showCycleWaiverView) {
                cells.push(
                  <span
                    key={`${row.customerId}-cycle-waiver-history-fee`}
                    className="block whitespace-nowrap text-sm text-slate-600"
                  >
                    {row.cycleWaiverTrafficFee ?? "--"}
                  </span>,
                );
                cells.push(
                  <span
                    key={`${row.customerId}-cycle-waiver-history-overspend`}
                    className={`block whitespace-nowrap text-sm font-medium ${
                      row.trafficCost && row.cycleOverspendUsd > 0 ? "text-rose-600" : "text-slate-600"
                    }`}
                  >
                    {row.trafficCost ? row.cycleOverspend ?? "--" : "--"}
                  </span>,
                );
                cells.push(
                  <span
                    key={`${row.customerId}-cycle-waiver-history-recharge`}
                    className="block whitespace-nowrap text-sm text-slate-600"
                  >
                    {row.availableRecharge ?? "--"}
                  </span>,
                );
                cells.push(
                  <span
                    key={`${row.customerId}-cycle-waiver-history-pending-top-up`}
                    className={`block whitespace-nowrap text-sm font-medium ${
                      row.trafficCost && row.pendingTopUpUsd > 0 ? "text-rose-600" : "text-slate-600"
                    }`}
                  >
                    {row.trafficCost ? row.pendingTopUp ?? "--" : "--"}
                  </span>,
                );
              }

              if (showCycleWaiverView) {
                cells.push(
                  <button
                    key={`${row.customerId}-cycle-history-action`}
                    type="button"
                    onClick={() => void loadCycleHistory(row)}
                    className="inline-flex whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium leading-none text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                  >
                    {t.trafficBoard.cycleHistory}
                  </button>,
                );
                return cells;
              }

              if (showNewCustomerGiftView) {
                cells.push(
                  <span key={`${row.customerId}-new-customer-gift`} className="block whitespace-nowrap text-sm text-slate-600">
                    {row.newCustomerGiftCredit ?? "--"}
                  </span>,
                );
                cells.push(
                  <span key={`${row.customerId}-cumulative-recharge`} className="block whitespace-nowrap text-sm text-slate-600">
                    {row.cumulativeRecharge ?? "--"}
                  </span>,
                );
                cells.push(
                  <span
                    key={`${row.customerId}-remaining-balance`}
                    className="block whitespace-nowrap text-sm font-medium text-slate-600"
                  >
                    {row.remainingBalance ?? "--"}
                  </span>,
                );
              }

              cells.push(
                <Link
                  key={`${row.customerId}-action`}
                  href={row.reportHref}
                  className="inline-flex whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium leading-none text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                >
                  {t.trafficBoard.openReport}
                </Link>,
              );

              return cells;
            })}
          />
        )}
      </Panel>
      <DashboardModal open={selectedHistoryCustomer !== null} onClose={closeCycleHistory} maxWidthClassName="max-w-5xl">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{t.trafficBoard.cycleHistory}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[0.01em] text-slate-950">
                {cycleHistory?.customerName ?? selectedHistoryCustomer?.customerName ?? t.trafficBoard.historyTitle}
              </h3>
              <p className="mt-2 text-sm text-slate-500">{t.trafficBoard.historyDescription}</p>
            </div>
            <button
              type="button"
              onClick={closeCycleHistory}
              className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
            >
              {t.trafficBoard.closeHistory}
            </button>
          </div>

          {cycleHistoryLoading ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              {t.trafficBoard.loadingHistory}
            </div>
          ) : cycleHistoryError ? (
            <div className="rounded-[24px] border border-dashed border-rose-200 bg-rose-50 px-5 py-8 text-center">
              <p className="text-sm text-rose-700">{cycleHistoryError}</p>
              {selectedHistoryCustomer ? (
                <button
                  type="button"
                  onClick={() => void loadCycleHistory(selectedHistoryCustomer)}
                  className="mt-3 inline-flex rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  {t.trafficBoard.retryHistory}
                </button>
              ) : null}
            </div>
          ) : cycleHistory ? (
            <DataTable
              compact
              fitToContainer
              columnClassNames={["w-[22%]", "w-[18%]", "w-[18%]", "w-[16%]", "w-[14%]", "w-[12%] text-center"]}
              headers={[
                t.trafficBoard.cycleRange,
                t.trafficBoard.cumulativeTraffic,
                t.trafficBoard.cycleTrafficCost,
                t.trafficBoard.cycleWaiverTrafficFee,
                t.trafficBoard.cycleOverspend,
                t.trafficBoard.action,
              ]}
              rows={cycleHistory.entries.map((entry) => [
                <span key={`${entry.cycleRange}-range`} className="block text-sm text-slate-700">
                  {entry.cycleRange}
                </span>,
                <div key={`${entry.cycleRange}-traffic`} className="min-w-0">
                  <span className="block text-sm font-medium text-slate-950">{entry.traffic}</span>
                  {entry.trafficHint ? <p className="mt-0.5 text-xs text-slate-500">{entry.trafficHint}</p> : null}
                </div>,
                <span key={`${entry.cycleRange}-cost`} className="block whitespace-nowrap text-sm text-slate-600">
                  {entry.trafficCost ?? "--"}
                </span>,
                <span key={`${entry.cycleRange}-waiver`} className="block whitespace-nowrap text-sm text-slate-600">
                  {entry.cycleWaiverTrafficFee ?? "--"}
                </span>,
                <span
                  key={`${entry.cycleRange}-overspend`}
                  className={`block whitespace-nowrap text-sm font-medium ${
                    entry.cycleOverspendUsd > 0 ? "text-rose-600" : "text-slate-600"
                  }`}
                >
                  {entry.hasLiveData ? entry.cycleOverspend : "--"}
                </span>,
                <Link
                  key={`${entry.cycleRange}-report`}
                  href={entry.reportHref}
                  className="inline-flex whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium leading-none text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-slate-950"
                >
                  {t.trafficBoard.openReport}
                </Link>,
              ])}
            />
          ) : null}
        </div>
      </DashboardModal>
    </div>
  );
}
