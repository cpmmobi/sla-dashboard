"use client";

import Link from "next/link";
import { type MouseEvent as ReactMouseEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Locale } from "@/lib/i18n";
import type { DualSeriesPoint, SeriesPoint } from "@/lib/dashboard-data";
import { LocaleSwitcher } from "@/components/locale-switcher";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  external?: boolean;
};

type DashboardShellProps = {
  locale: Locale;
  badge: string;
  nav: NavItem[];
  activeLabel: string;
  logoutLabel?: string;
  logoutHref?: string;
  footerContent?: ReactNode;
  children: ReactNode;
};

type MetricCardProps = {
  label: string;
  value: string;
  tone: "brand" | "success" | "warning";
  compact?: boolean;
};

type ListItem = {
  title: string;
  meta: string;
  tag: string;
};

type TableProps = {
  headers: ReactNode[];
  rows: ReactNode[][];
  compact?: boolean;
  fitToContainer?: boolean;
  columnClassNames?: string[];
};

type DashboardModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
};

const toneStyles: Record<MetricCardProps["tone"], string> = {
  brand: "from-rose-100 to-orange-50 text-rose-700",
  success: "from-emerald-100 to-green-50 text-emerald-700",
  warning: "from-amber-100 to-orange-50 text-amber-700",
};

function buildPointCoordinates(
  values: number[],
  height: number,
  width: number,
  xOffset = 0,
  yOffset = 0,
) {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((value, index) => ({
    x: xOffset + (index / (values.length - 1 || 1)) * width,
    y: yOffset + height - ((value - min) / range) * height,
    value,
  }));
}

function buildPointCoordinatesWithDomain(
  values: number[],
  height: number,
  width: number,
  min: number,
  max: number,
  xOffset = 0,
  yOffset = 0,
) {
  if (values.length === 0) {
    return [];
  }

  const range = max - min || 1;

  return values.map((value, index) => ({
    x: xOffset + (index / (values.length - 1 || 1)) * width,
    y: yOffset + height - ((value - min) / range) * height,
    value,
  }));
}

function stringifyCoordinates(values: Array<{ x: number; y: number }>) {
  return values.map((point) => `${point.x},${point.y}`).join(" ");
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = (previous.x + current.x) / 2;

    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

function buildSmoothAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${baselineY} L ${points[0].x} ${points[0].y} L ${points[0].x} ${baselineY} Z`;
  }

  return `${buildSmoothLinePath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

function buildHoverSegments(
  coordinates: Array<{ x: number; y: number }>,
  plotLeft: number,
  plotRight: number,
  chartWidth: number,
) {
  return coordinates.map((point, index) => {
    const previous = coordinates[index - 1];
    const next = coordinates[index + 1];
    const start = previous ? (previous.x + point.x) / 2 : plotLeft;
    const end = next ? (point.x + next.x) / 2 : chartWidth - plotRight;

    return {
      index,
      x: start,
      width: Math.max(end - start, 1),
    };
  });
}

function buildYAxisTicks(values: number[], fractionDigits = 0, height = 180, yOffset = 0) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min;

  if (span === 0) {
    return [
      { label: max.toFixed(fractionDigits), y: yOffset },
      { label: max.toFixed(fractionDigits), y: yOffset + height / 2 },
      { label: max.toFixed(fractionDigits), y: yOffset + height },
    ];
  }

  const top = max;
  const middle = min + span / 2;
  const bottom = min;

  return [
    { label: top.toFixed(fractionDigits), y: yOffset },
    { label: middle.toFixed(fractionDigits), y: yOffset + height / 2 },
    { label: bottom.toFixed(fractionDigits), y: yOffset + height },
  ];
}

function sampleAxisLabels<T extends { label: string }>(
  items: T[],
  chartWidth: number,
  maxCount = 7,
) {
  if (items.length === 0) {
    return [] as Array<{
      label: string;
      x: number;
      anchor: "start" | "middle" | "end";
    }>;
  }

  const resolveAnchor = (index: number, lastIndex: number): "start" | "middle" | "end" => {
    if (index === 0) {
      return "start";
    }

    if (index === lastIndex) {
      return "end";
    }

    return "middle";
  };

  if (items.length <= maxCount) {
    return items.map((item, index) => ({
      label: item.label,
      x: (index / Math.max(items.length - 1, 1)) * chartWidth,
      anchor: resolveAnchor(index, items.length - 1),
    }));
  }

  const indexes = new Set<number>();
  const lastIndex = items.length - 1;

  for (let index = 0; index < maxCount; index += 1) {
    indexes.add(Math.round((index * lastIndex) / Math.max(maxCount - 1, 1)));
  }

  return Array.from(indexes)
    .sort((left, right) => left - right)
    .map((index) => ({
      label: items[index].label,
      x: (index / Math.max(lastIndex, 1)) * chartWidth,
      anchor: resolveAnchor(index, lastIndex),
    }));
}

export function DashboardShell({
  locale,
  badge,
  nav,
  activeLabel,
  logoutLabel,
  logoutHref,
  footerContent,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="panel panel-strong hidden h-[calc(100vh-2rem)] w-72 shrink-0 self-start overflow-y-auto rounded-[28px] p-6 lg:sticky lg:top-4 lg:flex lg:flex-col">
          <div className="mb-10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-base font-semibold text-white shadow-lg shadow-rose-200/60">
                SLA
              </div>
              <p className="text-sm font-semibold tracking-[0.02em] text-slate-950">{badge}</p>
            </div>
          </div>

          <nav className="space-y-2">
            {nav.map((item) => (
              item.external ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                    item.active
                      ? "bg-gradient-to-r from-rose-50 to-orange-50 text-slate-950 ring-1 ring-inset ring-rose-200"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{item.active ? activeLabel : ""}</span>
                    <span aria-hidden="true" className="text-xs leading-none text-slate-400">
                      ↗
                    </span>
                  </span>
                </a>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                    item.active
                      ? "bg-gradient-to-r from-rose-50 to-orange-50 text-slate-950 ring-1 ring-inset ring-rose-200"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[11px] text-slate-500">{item.active ? activeLabel : ""}</span>
                </Link>
              )
            ))}
          </nav>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <LocaleSwitcher locale={locale} />
              {footerContent}
            </div>
            {logoutLabel && logoutHref ? (
              <a
                href={logoutHref}
                aria-label={logoutLabel}
                title={logoutLabel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 4.5H5.75A1.75 1.75 0 0 0 4 6.25v7.5c0 .97.78 1.75 1.75 1.75H7" />
                  <path d="M11 6.5 15 10l-4 3.5" />
                  <path d="M14.5 10H8" />
                </svg>
              </a>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}

export function DashboardModal({
  open,
  onClose,
  children,
  maxWidthClassName = "max-w-3xl",
}: DashboardModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overscrollBehavior = "contain";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
    };
  }, [mounted, open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/18 px-4 py-6 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={`panel relative z-10 max-h-[calc(100vh-3rem)] w-full ${maxWidthClassName} overflow-y-auto rounded-[32px] p-5 shadow-2xl shadow-slate-900/12 sm:p-6`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function MetricCard({ label, value, tone, compact = false }: MetricCardProps) {
  const valueClassName =
    value.length > 16
      ? "whitespace-nowrap text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
      : "whitespace-nowrap text-3xl font-semibold tracking-tight text-slate-950";

  return (
    <div
      className={`panel metric-glow rounded-[24px] bg-gradient-to-br ${toneStyles[tone]} ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className={compact ? "mt-4" : "mt-5"}>
        <p className={valueClassName}>{value}</p>
      </div>
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  children,
  aside,
  compact = false,
}: {
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`panel rounded-[28px] ${compact ? "p-4 sm:p-5" : "p-5 sm:p-6"}`}>
      <div
        className={`${compact ? "mb-4 gap-2" : "mb-6 gap-3"} flex flex-col sm:flex-row sm:items-end sm:justify-between`}
      >
        <div>
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{eyebrow}</p>
          ) : null}
          <h3 className={`${eyebrow ? "mt-2" : ""} text-xl font-semibold tracking-[0.01em] text-slate-950`}>
            {title}
          </h3>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SingleLineChart({
  data,
  color,
  suffix,
  variant = "line",
  strokeWidth = 2,
  pointRadius = 2.5,
  yAxisFormatter = (value: number) => `${value}`,
  tooltipTitle,
  tooltipValueFormatter = (value: number) => `${value}${suffix}`,
  compact = false,
}: {
  data: SeriesPoint[];
  color: string;
  suffix: string;
  variant?: "line" | "bar";
  strokeWidth?: number;
  pointRadius?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipTitle?: string;
  tooltipValueFormatter?: (value: number) => string;
  compact?: boolean;
}) {
  const gradientId = useId();
  const barGradientId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const values = data.map((point) => point.value);
  const chartWidth = 620;
  const plotLeft = 6;
  const plotRight = 2;
  const plotTop = 6;
  const plotHeight = 168;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const coordinates = buildPointCoordinates(values, plotHeight, plotWidth, plotLeft, plotTop);
  const linePath = buildSmoothLinePath(coordinates);
  const areaPath = buildSmoothAreaPath(coordinates, plotTop + plotHeight);
  const yAxisTicks = buildYAxisTicks(values, 0, plotHeight, plotTop);
  const axisLabels = sampleAxisLabels(data, plotWidth).map((point) => ({
    ...point,
    x: point.x + plotLeft,
  }));
  const barWidth = Math.max(Math.min(plotWidth / Math.max(data.length, 1) - 4, 14), 4);
  const hoverSegments = buildHoverSegments(coordinates, plotLeft, plotRight, chartWidth);
  const hoveredPoint =
    hoveredIndex === null
      ? null
      : {
          index: hoveredIndex,
          coordinate: coordinates[hoveredIndex],
          point: data[hoveredIndex],
        };
  const tooltipLabel = hoveredPoint?.point.tooltipLabel ?? hoveredPoint?.point.label;

  function updatePointerPosition(event: ReactMouseEvent<SVGElement>, fallbackY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    setPointerPosition({
      x: event.clientX - bounds.left,
      y: Math.max(event.clientY - bounds.top, fallbackY),
    });
  }

  return (
    <div>
      <div
        className={`grid-mask rounded-[24px] border border-slate-200 bg-white ${
          compact ? "p-2" : "p-2 sm:p-3"
        }`}
      >
        <div
          ref={containerRef}
          className="relative"
          onMouseLeave={() => {
            setHoveredIndex(null);
            setPointerPosition(null);
          }}
        >
          <svg
            viewBox={`0 0 ${chartWidth} 208`}
            preserveAspectRatio="none"
            className={`${compact ? "h-56" : "h-64"} w-full`}
          >
            {yAxisTicks.map((tick) => (
              <g key={`${tick.y}-${tick.label}`}>
                <text
                  x="2"
                  y={tick.y + 4}
                  fontSize="10"
                  fill="#94a3b8"
                >
                  {yAxisFormatter(Number(tick.label))}
                </text>
                <line
                  x1={plotLeft}
                  y1={tick.y}
                  x2={chartWidth - plotRight}
                  y2={tick.y}
                  stroke="rgba(148, 163, 184, 0.18)"
                  strokeDasharray="4 6"
                />
              </g>
            ))}
            <line
              x1={plotLeft}
              y1={plotTop + plotHeight}
              x2={chartWidth - plotRight}
              y2={plotTop + plotHeight}
              stroke="rgba(148, 163, 184, 0.28)"
            />
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={color} stopOpacity="0.45" />
              </linearGradient>
            </defs>
            {hoveredPoint ? (
              <>
                <line
                  x1={plotLeft}
                  y1={hoveredPoint.coordinate.y}
                  x2={chartWidth - plotRight}
                  y2={hoveredPoint.coordinate.y}
                  stroke={color}
                  strokeOpacity="0.14"
                  strokeDasharray="4 6"
                />
                <line
                  x1={hoveredPoint.coordinate.x}
                  y1={plotTop}
                  x2={hoveredPoint.coordinate.x}
                  y2={plotTop + plotHeight}
                  stroke={color}
                  strokeOpacity="0.18"
                  strokeDasharray="4 6"
                />
              </>
            ) : null}
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
              opacity={variant === "line" ? 1 : 0}
            />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={variant === "line" ? 1 : 0}
            />
            {coordinates.map((point, index) => (
              <g key={`${point.x}-${point.y}-${point.value}`}>
                {variant === "line" ? (
                  <>
                    {hoveredIndex === index ? (
                      <>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={pointRadius + 4}
                          fill={color}
                          fillOpacity="0.14"
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={pointRadius}
                          fill="#ffffff"
                          stroke={color}
                          strokeWidth="1.5"
                        />
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <rect
                      x={point.x - barWidth / 2}
                      y={point.y}
                      width={barWidth}
                      height={Math.max(plotTop + plotHeight - point.y, 2)}
                      rx="2"
                      fill={`url(#${barGradientId})`}
                      opacity={hoveredIndex === index ? 1 : 0.88}
                    />
                    {hoveredIndex === index ? (
                      <rect
                        x={point.x - barWidth / 2 - 1}
                        y={point.y - 1}
                        width={barWidth + 2}
                        height={Math.max(plotTop + plotHeight - point.y, 2) + 1}
                        rx="3"
                        fill="none"
                        stroke={color}
                        strokeOpacity="0.35"
                      />
                    ) : null}
                  </>
                )}
              </g>
            ))}
            {hoverSegments.map((segment) => (
              <rect
                key={`hover-segment-${segment.index}`}
                x={segment.x}
                y={plotTop}
                width={segment.width}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(segment.index)}
                onMouseMove={(event) => {
                  setHoveredIndex(segment.index);
                  updatePointerPosition(event, plotTop);
                }}
              />
            ))}
            {axisLabels.map((point) => (
              <text
                key={`${point.x}-${point.label}`}
                x={point.x}
                y="202"
                textAnchor={point.anchor}
                fontSize="11"
                fill="#64748b"
              >
                {point.label}
              </text>
            ))}
          </svg>
          {hoveredPoint ? (
            <div
              className="pointer-events-none absolute rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-xl shadow-slate-200"
              style={{
                left: `${Math.min(Math.max(pointerPosition?.x ?? hoveredPoint.coordinate.x, 84), chartWidth - 84)}px`,
                top: `${Math.max((pointerPosition?.y ?? hoveredPoint.coordinate.y) - 18, 8)}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="whitespace-nowrap text-slate-500">{tooltipLabel}</p>
              <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <p className="font-medium text-slate-950">
                  {tooltipTitle ? `${tooltipTitle}: ` : ""}
                  {tooltipValueFormatter(hoveredPoint.point.value)}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DualLineChart({ data }: { data: DualSeriesPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartWidth = 620;
  const plotLeft = 6;
  const plotRight = 2;
  const plotTop = 6;
  const plotHeight = 168;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const primaryValues = data.map((point) => point.primary);
  const secondaryValues = data.map((point) => point.secondary);
  const allValues = [...primaryValues, ...secondaryValues];
  const domainMin = Math.min(...allValues, 0);
  const domainMax = Math.max(...allValues, 0);
  const primaryCoordinates = buildPointCoordinatesWithDomain(
    primaryValues,
    plotHeight,
    plotWidth,
    domainMin,
    domainMax,
    plotLeft,
    plotTop,
  );
  const secondaryCoordinates = buildPointCoordinatesWithDomain(
    secondaryValues,
    plotHeight,
    plotWidth,
    domainMin,
    domainMax,
    plotLeft,
    plotTop,
  );
  const primary = stringifyCoordinates(primaryCoordinates);
  const secondary = stringifyCoordinates(secondaryCoordinates);
  const yAxisTicks = buildYAxisTicks(allValues, 0, plotHeight, plotTop);
  const axisLabels = sampleAxisLabels(data, plotWidth).map((point) => ({
    ...point,
    x: point.x + plotLeft,
  }));
  const hoveredPoint =
    hoveredIndex === null
      ? null
      : {
          point: data[hoveredIndex],
          primaryCoordinate: primaryCoordinates[hoveredIndex],
          secondaryCoordinate: secondaryCoordinates[hoveredIndex],
        };
  const tooltipLabel = hoveredPoint?.point.tooltipLabel ?? hoveredPoint?.point.label;

  return (
    <div>
      <div className="grid-mask rounded-[24px] border border-slate-200 bg-white p-2 sm:p-3">
        <div
          className="relative min-w-0"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div>
            <svg viewBox={`0 0 ${chartWidth} 208`} preserveAspectRatio="none" className="h-64 w-full">
              {yAxisTicks.map((tick) => (
                <g key={`${tick.y}-${tick.label}`}>
                  <text
                    x="2"
                    y={tick.y + 4}
                    fontSize="10"
                    fill="#94a3b8"
                  >
                    {Number(tick.label).toLocaleString("en-US")}
                  </text>
                  <line
                    x1={plotLeft}
                    y1={tick.y}
                    x2={chartWidth - plotRight}
                    y2={tick.y}
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeDasharray="4 6"
                  />
                </g>
              ))}
              <line
                x1={plotLeft}
                y1={plotTop + plotHeight}
                x2={chartWidth - plotRight}
                y2={plotTop + plotHeight}
                stroke="rgba(148, 163, 184, 0.28)"
              />
              {hoveredPoint ? (
                <>
                  <line
                    x1={plotLeft}
                    y1={hoveredPoint.primaryCoordinate.y}
                    x2={chartWidth - plotRight}
                    y2={hoveredPoint.primaryCoordinate.y}
                    stroke="#ef4444"
                    strokeOpacity="0.12"
                    strokeDasharray="4 6"
                  />
                  <line
                    x1={plotLeft}
                    y1={hoveredPoint.secondaryCoordinate.y}
                    x2={chartWidth - plotRight}
                    y2={hoveredPoint.secondaryCoordinate.y}
                    stroke="#10b981"
                    strokeOpacity="0.12"
                    strokeDasharray="4 6"
                  />
                  <line
                    x1={hoveredPoint.primaryCoordinate.x}
                    y1={plotTop}
                    x2={hoveredPoint.primaryCoordinate.x}
                    y2={plotTop + plotHeight}
                    stroke="rgba(148, 163, 184, 0.32)"
                    strokeDasharray="4 6"
                  />
                </>
              ) : null}
              {primaryCoordinates.map((point) => (
                <line
                  key={`dual-guide-${point.x}-${point.value}`}
                  x1={point.x}
                  y1={plotTop}
                  x2={point.x}
                  y2={plotTop + plotHeight}
                  stroke="rgba(148, 163, 184, 0.1)"
                />
              ))}
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={primary}
              />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={secondary}
              />
              {primaryCoordinates.map((point, index) => (
                <g key={`primary-point-${point.x}-${point.y}`}>
                  {hoveredIndex === index ? (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="#ef4444"
                      fillOpacity="0.18"
                    />
                  ) : null}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={hoveredIndex === index ? "3" : "2.25"}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth={hoveredIndex === index ? "1.8" : "1.2"}
                  />
                </g>
              ))}
              {secondaryCoordinates.map((point, index) => (
                <g key={`secondary-point-${point.x}-${point.y}`}>
                  {hoveredIndex === index ? (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="#10b981"
                      fillOpacity="0.18"
                    />
                  ) : null}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={hoveredIndex === index ? "3" : "2.25"}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={hoveredIndex === index ? "1.8" : "1.2"}
                  />
                </g>
              ))}
              {primaryCoordinates.map((point, index) => (
                <circle
                  key={`hit-area-${point.x}-${index}`}
                  cx={point.x}
                  cy={plotTop + plotHeight / 2}
                  r="12"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                />
              ))}
              {axisLabels.map((point) => (
                <text
                  key={`${point.x}-${point.label}`}
                  x={point.x}
                  y="202"
                  textAnchor={point.anchor}
                  fontSize="11"
                  fill="#64748b"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          </div>
          {hoveredPoint ? (
            <div
              className="pointer-events-none absolute rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-xl shadow-slate-200"
              style={{
                left: `${Math.min(Math.max(hoveredPoint.primaryCoordinate.x, 92), chartWidth - 92)}px`,
                top: `${Math.max(Math.min(hoveredPoint.primaryCoordinate.y, hoveredPoint.secondaryCoordinate.y) - 56, 8)}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="whitespace-nowrap text-slate-500">{tooltipLabel}</p>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <p className="font-medium text-slate-950">
                    PV: {hoveredPoint.point.primary.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <p className="font-medium text-slate-950">
                    UV: {hoveredPoint.point.secondary.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">PV</span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">UV</span>
      </div>
    </div>
  );
}

export function ActivityList({ items }: { items: ListItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={`${item.title}-${item.meta}`}
          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              {item.tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  compact = false,
  fitToContainer = false,
  columnClassNames,
}: TableProps) {
  return (
    <div className={`${fitToContainer ? "overflow-hidden" : "overflow-x-auto"} rounded-[24px] border border-slate-200 bg-white`}>
      <table className={`${fitToContainer ? "w-full table-fixed" : "min-w-full"} text-left text-sm`}>
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {headers.map((header, index) => (
              <th
                key={`header-${index}`}
                className={`${fitToContainer ? "px-2.5 py-2.5" : compact ? "px-5 py-3" : "px-5 py-3.5"} ${columnClassNames?.[index] ?? ""} font-medium`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t border-slate-100 text-slate-700">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cell}-${cellIndex}`}
                  className={`align-top ${fitToContainer ? "px-2.5 py-3" : compact ? "px-5 py-3.5" : "px-5 py-[18px]"} ${columnClassNames?.[cellIndex] ?? ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
