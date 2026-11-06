import dayjs from 'dayjs'
import type { EChartsOption, LegendComponentOption } from 'echarts'

export const CHART_COLORS = {
  accent: '#4c8dff',
  grid: '#2a2d38',
  text: '#8b8d98',
  axis: '#3a3d48',
  tooltip: 'rgba(24, 26, 32, 0.95)',
  area: 'rgba(76, 141, 255, 0.08)',
  sma: '#8b8d98',
  upperBand: '#34d399',
  lowerBand: '#f87171',
  buy: '#34d399',
  sell: '#f87171',
} as const

interface BaseChartInput {
  title: string
  dates: string[]
  logScale: boolean
  compact: boolean
}

const price = (v: number) => Number(v).toFixed(2)
const compactPrice = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(2))

/** Index of the first date in the current year; 0 if none (show everything). */
function ytdStartIndex(dates: string[]) {
  const i = dates.findIndex((d) => d >= `${new Date().getFullYear()}-01-01`)
  return i === -1 ? 0 : i
}

/** Everything both charts share: title, tooltip, grid, axes, zoom. */
export function baseChartOption({ title, dates, logScale, compact }: BaseChartInput) {
  const yAxisBase = {
    scale: true,
    min: 'dataMin',
    max: 'dataMax',
    axisLabel: {
      color: CHART_COLORS.text,
      fontSize: compact ? 10 : 12,
      formatter: compact ? compactPrice : price,
    },
    axisLine: { lineStyle: { color: CHART_COLORS.axis } },
    splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
  } as const

  return {
    title: {
      text: title,
      left: 'center',
      top: compact ? 4 : 10,
      textStyle: { fontSize: compact ? 13 : 16, fontWeight: 600, color: CHART_COLORS.text },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: compact ? 'line' : 'cross' },
      backgroundColor: CHART_COLORS.tooltip,
      borderColor: CHART_COLORS.grid,
      borderWidth: 1,
      textStyle: { color: '#e4e5ea', fontSize: compact ? 11 : 14 },
      valueFormatter: (v) => price(Number(v)),
    },
    grid: compact
      ? {
          left: 8,
          right: 8,
          top: 52,
          bottom: 40,
          outerBoundsMode: 'same',
          outerBoundsContain: 'axisLabel',
        }
      : { left: 50, right: 30, top: 80, bottom: 50 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_COLORS.axis } },
      axisLabel: {
        color: CHART_COLORS.text,
        hideOverlap: true,
        fontSize: compact ? 10 : 12,
        formatter: compact ? (d: string) => dayjs(d).format("MMM 'YY") : undefined,
      },
    },
    yAxis: logScale
      ? { type: 'log', logBase: 10, minorSplitLine: { show: true }, ...yAxisBase }
      : { type: 'value', ...yAxisBase },
    dataZoom: [
      {
        type: 'inside',
        zoomOnMouseWheel: true,
        startValue: ytdStartIndex(dates),
        endValue: dates.length - 1,
      },
      {
        type: 'slider',
        height: compact ? 24 : 20,
        bottom: compact ? 6 : 10,
        showDetail: !compact,
        startValue: ytdStartIndex(dates),
        endValue: dates.length - 1,
        borderColor: 'transparent',
        backgroundColor: '#1e2028',
        fillerColor: 'rgba(76, 141, 255, 0.15)',
        handleStyle: { color: CHART_COLORS.accent, borderColor: CHART_COLORS.accent },
        moveHandleStyle: { color: CHART_COLORS.accent },
        textStyle: { color: CHART_COLORS.text },
        dataBackground: {
          lineStyle: { color: CHART_COLORS.grid },
          areaStyle: { color: '#1e2028' },
        },
      },
    ],
  } satisfies EChartsOption
}

/**
 * Desktop: thin line swatches, laid out by the caller via `overrides`.
 * Mobile: a single scrollable row with square swatches.
 */
export function legendOption(
  compact: boolean,
  overrides: LegendComponentOption = {},
): LegendComponentOption {
  const layout: LegendComponentOption = compact
    ? {
        type: 'scroll',
        top: 26,
        itemGap: 12,
        itemWidth: 10,
        itemHeight: 10,
        pageIconColor: CHART_COLORS.text,
        pageTextStyle: { color: CHART_COLORS.text },
      }
    : { top: 40, itemGap: 30, icon: 'rect', itemWidth: 16, itemHeight: 1.8 }

  return {
    left: 'center',
    textStyle: { color: CHART_COLORS.text, fontSize: compact ? 11 : 12 },
    ...layout,
    ...overrides,
  }
}
