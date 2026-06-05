"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataTable,
  MetricCard,
  Panel,
  SingleLineChart,
} from "@/components/dashboard-ui";
import { getTranslations, Locale } from "@/lib/i18n";
import { ALL_CLIENT_DOMAINS } from "@/lib/client-report-constants";
import type { AdminReportRecord, ClientDashboard } from "@/lib/mock-backend";
import {
  CLIENT_REPORT_MIN_DATE,
  defaultReportFilters,
  formatUtcOffset,
  getResolvedReportTimeZone,
  getResolvedReportTimeZoneOffsetMinutes,
  getReportLocationLabel,
  HKMO_LOCATION_VALUES,
  normalizeClientReportFilters,
  POPULAR_REPORT_LOCATIONS,
  serializeCustomRange,
  serializeReportLocations,
  splitDateTime,
  type ReportArea,
  type ReportFilters,
  type ReportQueryMode,
  type ReportTimeRange,
} from "@/lib/report-query";

type TrafficReportViewProps =
  | {
      mode: "client";
      dashboard: ClientDashboard;
      locale: Locale;
      filters: ReportFilters;
    }
  | {
      mode: "admin";
      records: AdminReportRecord[];
      locale: Locale;
      filters: ReportFilters;
    };

const filterFieldClassName =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white";
const pillButtonClassName =
  "rounded-2xl px-4 py-2.5 text-sm font-medium transition";

type ReportQueryType = ReportQueryMode;
type RegionKey = ReportArea;
type TrafficChartView = "traffic" | "bandwidth";
type AudienceChartView = "uv" | "pv";

type CustomRangeState = {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
};

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ToolbarGroup({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

export function TrafficReportView(props: TrafficReportViewProps) {
  const t = getTranslations(props.locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterTimeZone = getResolvedReportTimeZone(props.filters);
  const filterTimeZoneOffsetMinutes = getResolvedReportTimeZoneOffsetMinutes(props.filters);
  const [queryType, setQueryType] = useState<ReportQueryType>(
    props.filters.queryType ?? "traffic",
  );
  const [selectedTimeRange, setSelectedTimeRange] = useState<ReportTimeRange>(
    props.filters.timeRange ?? defaultReportFilters.timeRange,
  );
  const [trafficChartView, setTrafficChartView] = useState<TrafficChartView>("traffic");
  const [audienceChartView, setAudienceChartView] = useState<AudienceChartView>("uv");
  const [selectedRegion, setSelectedRegion] = useState<RegionKey>(
    props.filters.area ?? defaultReportFilters.area,
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    props.filters.locations ?? defaultReportFilters.locations ?? [],
  );
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
  const [regionDraft, setRegionDraft] = useState<RegionKey>(
    props.filters.area ?? defaultReportFilters.area,
  );
  const [locationDraft, setLocationDraft] = useState<string[]>(
    props.filters.locations ?? defaultReportFilters.locations ?? [],
  );
  const [browserTimeZone, setBrowserTimeZone] = useState(filterTimeZone);
  const [browserTimeZoneOffsetMinutes, setBrowserTimeZoneOffsetMinutes] = useState(
    filterTimeZoneOffsetMinutes,
  );
  const initialFrom = splitDateTime(props.filters.from, filterTimeZoneOffsetMinutes);
  const initialTo = splitDateTime(props.filters.to, filterTimeZoneOffsetMinutes);
  const [customRangeDraft, setCustomRangeDraft] = useState<CustomRangeState>({
    fromDate: initialFrom.date,
    fromTime: initialFrom.time,
    toDate: initialTo.date,
    toTime: initialTo.time,
  });
  const [customRangeApplied, setCustomRangeApplied] = useState<CustomRangeState>({
    fromDate: initialFrom.date,
    fromTime: initialFrom.time,
    toDate: initialTo.date,
    toTime: initialTo.time,
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    props.mode === "admin"
      ? props.filters.customerId ?? props.records[0]?.customerId ?? ""
      : "",
  );
  const [selectedDomain, setSelectedDomain] = useState(
    props.filters.domain ??
      (props.mode === "admin"
        ? props.records[0]?.domain ?? ""
        : props.dashboard.selectedDomain),
  );
  const isClientMode = props.mode === "client";

  const report = useMemo(() => {
    if (props.mode === "client") {
      return props.dashboard;
    }

    return (
      props.records.find(
        (item) =>
          item.customerId === selectedCustomerId &&
          (selectedDomain ? item.domain === selectedDomain : true),
      ) ??
      props.records.find((item) => item.customerId === selectedCustomerId) ??
      props.records[0]
    );
  }, [props, selectedCustomerId, selectedDomain]);
  const reportNotice =
    props.mode === "client"
      ? props.dashboard.reportNotice ?? null
      : report?.reportNotice ?? null;

  const customerOptions =
    props.mode === "admin"
      ? Array.from(new Map(props.records.map((item) => [item.customerId, item.customerName])).entries())
      : [];

  const selectedAdminCustomer =
    props.mode === "admin"
      ? props.records.find((item) => item.customerId === selectedCustomerId)?.customer ?? null
      : null;

  const domainOptions =
    props.mode === "admin"
      ? Array.from(
          new Set(
            props.records
              .filter((item) => !selectedCustomerId || item.customerId === selectedCustomerId)
              .map((item) => item.domain),
          ),
        )
      : queryType === "traffic"
        ? [ALL_CLIENT_DOMAINS, ...props.dashboard.availableDomains]
        : props.dashboard.availableDomains;

  const replaceParams = useCallback((patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    const mergedPatch = {
      tz: browserTimeZone,
      tzOffset: String(browserTimeZoneOffsetMinutes),
      ...patch,
    };

    Object.entries(mergedPatch).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.replace(`${pathname}?${params.toString()}`);
  }, [browserTimeZone, browserTimeZoneOffsetMinutes, pathname, router, searchParams]);

  useEffect(() => {
    let detectedTimeZone = filterTimeZone;

    try {
      detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || filterTimeZone;
    } catch {
      detectedTimeZone = filterTimeZone;
    }

    const detectedOffsetMinutes = -new Date().getTimezoneOffset();

    setBrowserTimeZone(detectedTimeZone);
    setBrowserTimeZoneOffsetMinutes(detectedOffsetMinutes);

    if (
      props.filters.timeZone !== detectedTimeZone ||
      props.filters.timeZoneOffsetMinutes !== detectedOffsetMinutes
    ) {
      replaceParams({
        tz: detectedTimeZone,
        tzOffset: String(detectedOffsetMinutes),
      });
    }
  }, [
    filterTimeZone,
    props.filters.timeZone,
    props.filters.timeZoneOffsetMinutes,
    replaceParams,
  ]);

  useEffect(() => {
    if (
      props.mode === "client" &&
      queryType === "audience" &&
      selectedDomain === ALL_CLIENT_DOMAINS
    ) {
      setSelectedDomain(props.dashboard.availableDomains[0] ?? "");
    }
  }, [props, queryType, selectedDomain]);

  useEffect(() => {
    if (
      props.mode === "admin" &&
      queryType === "audience" &&
      selectedDomain === ALL_CLIENT_DOMAINS
    ) {
      const nextDomain = selectedAdminCustomer?.domains[0] ?? "";
      if (nextDomain) {
        setSelectedDomain(nextDomain);
      }
    }
  }, [props.mode, queryType, selectedAdminCustomer, selectedDomain]);

  if (!report) {
    return null;
  }

  const selectedRangeLabel =
    selectedTimeRange === "custom"
      ? t.reports.selectedRange(
          `${customRangeApplied.fromDate} ${customRangeApplied.fromTime}`,
          `${customRangeApplied.toDate} ${customRangeApplied.toTime}`,
        )
      : t.reports.timeRangeOptions[selectedTimeRange];
  const hasTrafficData = report.trafficTrend.length > 0 || report.peakBandwidth.length > 0;
  const hasAudienceData = report.pvUvTrend.length > 0;
  const hasTrafficUsageRows = report.trafficUsageTable.length > 0;
  const hasAudienceUsageRows = report.audienceUsageTable.length > 0;
  const hasRegionalTrafficRows = report.regionalTrafficTable.length > 0;
  const activeTrafficSeries = trafficChartView === "traffic" ? report.trafficTrend : report.peakBandwidth;
  const activeAudienceSeries = report.pvUvTrend.map((point) => ({
    label: point.label,
    tooltipLabel: point.tooltipLabel,
    value: audienceChartView === "uv" ? point.secondary : point.primary,
  }));
  const hasCurrentData =
    queryType === "traffic"
      ? hasTrafficData || hasTrafficUsageRows
      : hasAudienceData || hasAudienceUsageRows;
  const regionSummaryLabel = useMemo(() => {
    if (selectedLocations.length > 0) {
      if (selectedLocations.length === 1) {
        return getReportLocationLabel(selectedLocations[0], props.locale);
      }

      const firstLocation = getReportLocationLabel(selectedLocations[0], props.locale);
      return `${firstLocation} +${selectedLocations.length - 1}`;
    }

    if (selectedRegion === "mainland" || selectedRegion === "overseas") {
      return t.reports.regionOptions[selectedRegion];
    }

    return t.reports.regionOptions.all;
  }, [props.locale, selectedLocations, selectedRegion, t.reports]);

  const trafficCards = report.metrics.slice(0, 4);
  const audienceCards = report.metrics.slice(4, 8);

  const filterColumnClassName =
    props.mode === "admin"
      ? queryType === "traffic"
        ? "xl:grid-cols-4"
        : "xl:grid-cols-3"
      : queryType === "traffic"
        ? "xl:grid-cols-3"
        : "xl:grid-cols-2";
  const metricGridClassName = "xl:grid-cols-4";
  const explainedRegionCodes = new Set(["CN", "AP1", "AP2", "AP3"]);

  function buildReportFilterState(
    timeRange: ReportTimeRange,
    customRange: CustomRangeState,
  ): ReportFilters {
    const nextFilters: ReportFilters = {
      queryType,
      timeRange,
      area: queryType === "traffic" ? selectedRegion : defaultReportFilters.area,
      locations: queryType === "traffic" ? selectedLocations : [],
      timeZone: browserTimeZone,
      timeZoneOffsetMinutes: browserTimeZoneOffsetMinutes,
      domain: selectedDomain || undefined,
      from: timeRange === "custom" ? serializeCustomRange(customRange.fromDate, customRange.fromTime) : undefined,
      to: timeRange === "custom" ? serializeCustomRange(customRange.toDate, customRange.toTime) : undefined,
      ...(props.mode === "admin" ? { customerId: selectedCustomerId || undefined } : {}),
    };

    return isClientMode ? normalizeClientReportFilters(nextFilters) : nextFilters;
  }

  function renderRegionCell(regionCode: string, regionLabel: string) {
    if (!explainedRegionCodes.has(regionCode)) {
      return regionLabel;
    }

    const helpText = t.reports.regionalTrafficRegionHelps[
      regionCode as keyof typeof t.reports.regionalTrafficRegionHelps
    ];

    if (!helpText) {
      return regionLabel;
    }

    return (
      <div className="flex items-center gap-2">
        <span>{regionLabel}</span>
        <div className="group relative">
          <span className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-600">
            ?
          </span>
          <div className="invisible absolute left-0 top-5 z-10 w-80 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-normal leading-6 text-slate-600 opacity-0 shadow-xl shadow-slate-200 transition duration-150 group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto">
            <p>{helpText}</p>
          </div>
        </div>
      </div>
    );
  }

  function updateCustomDraft(key: keyof CustomRangeState, value: string) {
    setCustomRangeDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyCustomRange() {
    const normalizedFilters = buildReportFilterState("custom", customRangeDraft);
    const normalizedFrom = splitDateTime(normalizedFilters.from, browserTimeZoneOffsetMinutes);
    const normalizedTo = splitDateTime(normalizedFilters.to, browserTimeZoneOffsetMinutes);
    const normalizedRange = {
      fromDate: normalizedFrom.date,
      fromTime: normalizedFrom.time,
      toDate: normalizedTo.date,
      toTime: normalizedTo.time,
    };

    setCustomRangeDraft(normalizedRange);
    setCustomRangeApplied(normalizedRange);
    setSelectedTimeRange(normalizedFilters.timeRange);
    setIsCustomRangeOpen(false);
    replaceParams({
      range: normalizedFilters.timeRange,
      from: normalizedFilters.timeRange === "custom" ? normalizedFilters.from : undefined,
      to: normalizedFilters.timeRange === "custom" ? normalizedFilters.to : undefined,
    });
  }

  function cancelCustomRange() {
    setCustomRangeDraft(customRangeApplied);
    setIsCustomRangeOpen(false);
  }

  function applyFilters() {
    const normalizedFilters = buildReportFilterState(selectedTimeRange, customRangeApplied);
    replaceParams({
      queryType,
      range: normalizedFilters.timeRange,
      from: normalizedFilters.timeRange === "custom" ? normalizedFilters.from : undefined,
      to: normalizedFilters.timeRange === "custom" ? normalizedFilters.to : undefined,
      area: queryType === "traffic" ? selectedRegion : undefined,
      locations:
        queryType === "traffic" && selectedLocations.length > 0
          ? serializeReportLocations(selectedLocations)
          : undefined,
      customerId: props.mode === "admin" ? selectedCustomerId || undefined : undefined,
      domain: selectedDomain || undefined,
    });
  }

  function applyRegionPreset(nextRegion: Exclude<RegionKey, "custom">) {
    setRegionDraft(nextRegion);
    setLocationDraft([]);
  }

  function toggleLocation(location: string) {
    setRegionDraft("custom");
    setLocationDraft((current) => {
      const next = current.includes(location)
        ? current.filter((item) => item !== location)
        : [...current, location];

      return next;
    });
  }

  function clearSelectedLocations() {
    setRegionDraft("all");
    setLocationDraft([]);
  }

  function openRegionModal() {
    setRegionDraft(selectedRegion);
    setLocationDraft(selectedLocations);
    setIsRegionMenuOpen(true);
  }

  function closeRegionModal() {
    setRegionDraft(selectedRegion);
    setLocationDraft(selectedLocations);
    setIsRegionMenuOpen(false);
  }

  function confirmRegionModal() {
    setSelectedRegion(regionDraft);
    setSelectedLocations(locationDraft);
    setIsRegionMenuOpen(false);
  }

  return (
    <div className="space-y-4">
      <Panel
        compact
        title={t.reports.reportTitle}
      >
        <div className="space-y-4">
          {isClientMode ? (
            <div className="overflow-x-auto rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <div className="space-y-1">
                <p className="whitespace-nowrap">{t.reports.clientAvailabilityNotice(CLIENT_REPORT_MIN_DATE)}</p>
                <p>{t.reports.clientSecurityNotice}</p>
              </div>
            </div>
          ) : null}
          {reportNotice ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              {reportNotice}
            </div>
          ) : null}
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
            <div className="space-y-3">
              <ToolbarGroup label={t.reports.queryType}>
                {([
                  ["traffic", t.reports.queryTypes.traffic],
                  ["audience", t.reports.queryTypes.audience],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setQueryType(key);
                    }}
                    className={`${pillButtonClassName} ${
                      queryType === key
                        ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </ToolbarGroup>

              <ToolbarGroup
                label={
                  <>
                    <span>{t.reports.timeRange}</span>
                    <span className="text-[10px] tracking-[0.16em] text-slate-400 normal-case">
                      {formatUtcOffset(browserTimeZoneOffsetMinutes)}
                    </span>
                  </>
                }
              >
                {(
                  Object.entries(t.reports.timeRangeOptions) as Array<[ReportTimeRange, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (value === "custom") {
                        setIsCustomRangeOpen(true);
                        return;
                      }

                      setSelectedTimeRange(value);
                      setIsCustomRangeOpen(false);
                    }}
                    className={`${pillButtonClassName} ${
                      selectedTimeRange === value
                        ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {value === "custom" && selectedTimeRange === "custom" ? selectedRangeLabel : label}
                  </button>
                ))}
              </ToolbarGroup>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className={`grid flex-1 gap-3 md:grid-cols-2 xl:items-end ${filterColumnClassName}`}>
                  {props.mode === "admin" ? (
                    <FilterField label={t.reports.selectCustomer}>
                      <select
                        value={selectedCustomerId}
                        onChange={(event) => {
                          const nextCustomerId = event.target.value;
                          const nextCustomer =
                            props.records.find((item) => item.customerId === nextCustomerId)?.customer ?? null;
                          const nextDomain =
                            queryType === "traffic" && (nextCustomer?.domains.length ?? 0) > 1
                              ? ALL_CLIENT_DOMAINS
                              : nextCustomer?.domains[0] ?? "";
                          setSelectedCustomerId(nextCustomerId);
                          setSelectedDomain(nextDomain);
                        }}
                        className={filterFieldClassName}
                      >
                        {customerOptions.map(([id, name]) => (
                          <option key={id} value={id} className="bg-white">
                            {name}
                          </option>
                        ))}
                      </select>
                    </FilterField>
                  ) : null}

                  <FilterField label={t.reports.selectDomain}>
                    <select
                      value={selectedDomain}
                      onChange={(event) =>
                        props.mode === "admin"
                          ? (() => {
                              const nextDomain = event.target.value;
                              setSelectedDomain(nextDomain);
                            })()
                          : setSelectedDomain(event.target.value)
                      }
                      className={filterFieldClassName}
                    >
                      {domainOptions.map((domain) => (
                        <option key={domain} value={domain} className="bg-white">
                          {domain === ALL_CLIENT_DOMAINS ? t.reports.allDomains : domain}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  {queryType === "traffic" ? (
                    <FilterField label={t.reports.region}>
                      <button
                        type="button"
                        onClick={openRegionModal}
                        className={`${filterFieldClassName} flex items-center justify-between text-left`}
                      >
                        <span className="truncate">{regionSummaryLabel}</span>
                        <span className="ml-3 text-xs text-slate-400">
                          {selectedLocations.length > 0
                            ? t.reports.selectedCountries(selectedLocations.length)
                            : ""}
                        </span>
                      </button>
                    </FilterField>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 xl:w-44 xl:shrink-0">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
                  >
                    {t.reports.search}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isCustomRangeOpen ? (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/60 p-3 sm:p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="grid flex-1 gap-3 md:grid-cols-2 xl:max-w-3xl">
                  <div className="grid gap-4 md:grid-cols-[72px_1fr_120px] md:items-center">
                    <span className="text-sm font-medium text-slate-700">{t.reports.fromDate}</span>
                    <input
                      type="date"
                      value={customRangeDraft.fromDate}
                      onChange={(event) => updateCustomDraft("fromDate", event.target.value)}
                      min={isClientMode ? CLIENT_REPORT_MIN_DATE : undefined}
                      className={filterFieldClassName}
                    />
                    <input
                      type="time"
                      value={customRangeDraft.fromTime}
                      onChange={(event) => updateCustomDraft("fromTime", event.target.value)}
                      className={filterFieldClassName}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[72px_1fr_120px] md:items-center">
                    <span className="text-sm font-medium text-slate-700">{t.reports.toDate}</span>
                    <input
                      type="date"
                      value={customRangeDraft.toDate}
                      onChange={(event) => updateCustomDraft("toDate", event.target.value)}
                      min={isClientMode ? CLIENT_REPORT_MIN_DATE : undefined}
                      className={filterFieldClassName}
                    />
                    <input
                      type="time"
                      value={customRangeDraft.toTime}
                      onChange={(event) => updateCustomDraft("toTime", event.target.value)}
                      className={filterFieldClassName}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 xl:shrink-0">
                  <button
                    type="button"
                    onClick={cancelCustomRange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {t.reports.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={applyCustomRange}
                    className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
                  >
                    {t.reports.confirm}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      {isRegionMenuOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/18 px-4 py-6 backdrop-blur-[2px]">
          <div
            className="absolute inset-0"
            onClick={closeRegionModal}
            aria-hidden="true"
          />
          <div className="panel relative z-10 w-full max-w-3xl rounded-[32px] p-5 shadow-2xl shadow-slate-900/12 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  {t.reports.region}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  {t.reports.region}
                </h3>
              </div>
              {locationDraft.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSelectedLocations}
                  className="text-sm font-medium text-rose-500 transition hover:text-rose-600"
                >
                  {t.reports.clearRegionSelection}
                </button>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyRegionPreset("all")}
                className={`${pillButtonClassName} ${
                  regionDraft === "all" && locationDraft.length === 0
                    ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.reports.regionOptions.all}
              </button>
              <button
                type="button"
                onClick={() => applyRegionPreset("mainland")}
                className={`${pillButtonClassName} ${
                  regionDraft === "mainland" && locationDraft.length === 0
                    ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.reports.regionOptions.mainland}
              </button>
              <button
                type="button"
                onClick={() => applyRegionPreset("overseas")}
                className={`${pillButtonClassName} ${
                  regionDraft === "overseas" && locationDraft.length === 0
                    ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.reports.regionOptions.overseas}
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-medium text-slate-700">{t.reports.hkmt}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {HKMO_LOCATION_VALUES.map((location) => {
                  const checked = locationDraft.includes(location);
                  return (
                    <label
                      key={location}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                        checked
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLocation(location)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-300"
                      />
                      <span>{getReportLocationLabel(location, props.locale)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-medium text-slate-700">{t.reports.popularCountries}</p>
              <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {POPULAR_REPORT_LOCATIONS.filter(
                  (option) =>
                    !HKMO_LOCATION_VALUES.includes(
                      option.value as (typeof HKMO_LOCATION_VALUES)[number],
                    ),
                ).map((option) => {
                  const checked = locationDraft.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                        checked
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLocation(option.value)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-300"
                      />
                      <span>{option.label[props.locale]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRegionModal}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t.reports.cancel}
              </button>
              <button
                type="button"
                onClick={confirmRegionModal}
                className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200 transition hover:brightness-110"
              >
                {t.reports.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className={`grid gap-3 md:grid-cols-2 ${metricGridClassName}`}>
        {(queryType === "traffic" ? trafficCards : audienceCards).map((metric) => (
          <MetricCard key={metric.label} compact {...metric} />
        ))}
      </section>

      {!hasCurrentData ? (
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">{t.reports.noDataTitle}</p>
          <p className="mt-2 text-sm text-slate-500">{t.reports.noDataDescription}</p>
        </section>
      ) : null}

      {queryType === "traffic" ? (
        <>
          <section>
            <Panel
              compact
              title={
                trafficChartView === "traffic"
                  ? t.reports.trafficTitle
                  : t.reports.bandwidthTitle
              }
              aside={
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {(["traffic", "bandwidth"] as const).map((view) => {
                    const active = trafficChartView === view;

                    return (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setTrafficChartView(view)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {t.reports.chartViews[view]}
                      </button>
                    );
                  })}
                </div>
              }
            >
              {hasTrafficData ? (
                <SingleLineChart
                  compact
                  data={activeTrafficSeries}
                  color={trafficChartView === "traffic" ? "#ef4444" : "#f59e0b"}
                  suffix={trafficChartView === "traffic" ? " GB" : " Mbps"}
                  variant={trafficChartView === "traffic" ? "bar" : "line"}
                  strokeWidth={trafficChartView === "traffic" ? 2 : 1.35}
                  pointRadius={trafficChartView === "traffic" ? 2.5 : 1.9}
                  yAxisFormatter={(value) =>
                    `${value.toLocaleString(props.locale === "en" ? "en-US" : "zh-CN", {
                      maximumFractionDigits: 2,
                    })}${trafficChartView === "traffic" ? " GB" : " Mbps"}`
                  }
                  tooltipTitle={
                    trafficChartView === "traffic"
                      ? t.reports.trafficTitle
                      : t.reports.bandwidthTitle
                  }
                  tooltipValueFormatter={(value) =>
                    `${value.toLocaleString(props.locale === "en" ? "en-US" : "zh-CN", {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}${trafficChartView === "traffic" ? " GB" : " Mbps"}`
                  }
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-500">
                  {t.reports.noDataDescription}
                </div>
              )}
            </Panel>
          </section>

          <section>
            <Panel
              compact
              title={t.reports.regionalTrafficTitle}
              aside={
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                  {t.reports.regionalTrafficTotalCost}: {report.regionalTrafficTotalCost}
                </span>
              }
            >
              {hasRegionalTrafficRows ? (
                <DataTable
                  compact
                  headers={[
                    t.reports.regionalTrafficHeaders[0],
                    t.reports.regionalTrafficHeaders[1],
                    t.reports.regionalTrafficHeaders[2],
                    <div key="unit-price-header" className="flex items-center gap-2">
                      <span>{t.reports.regionalTrafficHeaders[3]}</span>
                      <div className="group relative">
                        <span className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-600">
                          ?
                        </span>
                        <div className="invisible absolute left-0 top-5 z-10 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-normal leading-6 text-slate-600 opacity-0 shadow-xl shadow-slate-200 transition duration-150 group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto">
                          <p>{t.reports.regionalTrafficPricingHelp}</p>
                          <a
                            href="https://www.alibabacloud.com/help/live/product-overview/resource-plans?spm=a2c63.p38356.0.i2#1ee19723aauzr"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-sm font-medium text-rose-600 hover:text-rose-700"
                          >
                            {t.reports.regionalTrafficPricingLink}
                          </a>
                        </div>
                      </div>
                    </div>,
                    t.reports.regionalTrafficHeaders[4],
                  ]}
                  rows={report.regionalTrafficTable.map((row) => [
                    renderRegionCell(row.regionCode, row.region),
                    row.traffic,
                    row.share,
                    row.unitPrice,
                    row.cost,
                  ])}
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-500">
                  {t.reports.noDataDescription}
                </div>
              )}
            </Panel>
          </section>

          <section>
            <Panel
              compact
              title={t.reports.trafficTableTitle}
            >
              {hasTrafficUsageRows ? (
                <DataTable
                  compact
                  headers={[...t.reports.trafficTableHeaders]}
                  rows={report.trafficUsageTable.map((row) => [row.period, row.traffic, row.peakBps])}
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-500">
                  {t.reports.noDataDescription}
                </div>
              )}
            </Panel>
          </section>
        </>
      ) : (
        <>
          <section>
            <Panel
              compact
              title={audienceChartView === "uv" ? t.reports.uvTitle : t.reports.pvTitle}
              aside={
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {(["uv", "pv"] as const).map((view) => {
                    const active = audienceChartView === view;

                    return (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setAudienceChartView(view)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {t.reports.audienceChartViews[view]}
                      </button>
                    );
                  })}
                </div>
              }
            >
              {hasAudienceData ? (
                <SingleLineChart
                  compact
                  data={activeAudienceSeries}
                  color={audienceChartView === "uv" ? "#10b981" : "#ef4444"}
                  suffix=""
                  variant="line"
                  strokeWidth={1.35}
                  pointRadius={1.9}
                  yAxisFormatter={(value) =>
                    value.toLocaleString(props.locale === "en" ? "en-US" : "zh-CN", {
                      maximumFractionDigits: 0,
                    })
                  }
                  tooltipTitle={audienceChartView === "uv" ? "UV" : "PV"}
                  tooltipValueFormatter={(value) =>
                    value.toLocaleString(props.locale === "en" ? "en-US" : "zh-CN", {
                      maximumFractionDigits: 0,
                    })
                  }
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-500">
                  {t.reports.noDataDescription}
                </div>
              )}
            </Panel>
          </section>

          <section>
            <Panel
              compact
              title={t.reports.audienceTableTitle}
            >
              {hasAudienceUsageRows ? (
                <DataTable
                  compact
                  headers={[...t.reports.audienceTableHeaders]}
                  rows={report.audienceUsageTable.map((row) => [row.period, row.pv, row.uv])}
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-500">
                  {t.reports.noDataDescription}
                </div>
              )}
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
