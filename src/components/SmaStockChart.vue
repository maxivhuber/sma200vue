<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
import type { DataZoomEvent } from '@/types/DataZoomEvent'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const CHART_COLORS = {
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
}

const props = defineProps<{
  symbol: string
  data: {
    symbol: string
    strategy: 'sma'
    timestamp: string
    result: {
      dates: string[]
      prices: number[]
      sma: number[]
      upper_band: number[]
      lower_band: number[]
      signal: string[]
    }
  } | null
  logScale: boolean
}>()

const zoomStartValue = ref<number | null>(null)
const zoomEndValue = ref<number | null>(null)

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function isDataZoomEvent(raw: unknown): raw is DataZoomEvent {
  return typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'datazoom'
}

const renderChart = () => {
  if (!chart || !props.data) return

  const r = props.data.result

  if (zoomStartValue.value === null || zoomEndValue.value === null) {
    const ytdYear = new Date().getFullYear()
    const ytdStartDate = `${ytdYear}-01-01`
    const startIndex = r.dates.findIndex((d) => d >= ytdStartDate)
    const endIndex = r.dates.length - 1

    zoomStartValue.value = startIndex
    zoomEndValue.value = endIndex
  }

  const yAxisBase = {
    scale: true,
    min: 'dataMin' as const,
    max: 'dataMax' as const,
    axisLabel: {
      color: CHART_COLORS.text,
      formatter: (v: number) => Number(v).toFixed(2),
    },
    axisLine: { lineStyle: { color: CHART_COLORS.axis } },
    splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' as const } },
  }

  chart.setOption(
    {
      title: {
        text: props.symbol,
        left: 'center',
        top: 6,
        textStyle: { fontSize: 18, fontWeight: '600' as const, color: CHART_COLORS.text },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: CHART_COLORS.tooltip,
        borderColor: CHART_COLORS.grid,
        borderWidth: 1,
        textStyle: { color: '#e4e5ea' },
        valueFormatter: (v: number) => Number(v).toFixed(2),
      },
      legend: [
        {
          left: 'center',
          top: 32,
          itemGap: 30,
          data: [
            { name: 'Price', icon: 'rect' },
            { name: 'SMA', icon: 'rect' },
            { name: 'Upper Band', icon: 'rect' },
            { name: 'Lower Band', icon: 'rect' },
          ],
          itemWidth: 16,
          itemHeight: 1.8,
          textStyle: { color: CHART_COLORS.text },
        },
        {
          left: 'center',
          top: 52,
          itemGap: 15,
          data: [
            { name: 'Buy Signal', icon: 'circle' },
            { name: 'Sell Signal', icon: 'circle' },
          ],
          itemWidth: 12,
          itemHeight: 12,
          textStyle: { fontSize: 12, color: CHART_COLORS.text },
        },
      ],
      grid: { left: 50, right: 30, top: 80, bottom: 50 },
      xAxis: {
        type: 'category',
        data: r.dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        axisLabel: { color: CHART_COLORS.text },
      },
      yAxis: props.logScale
        ? { type: 'log', logBase: 10, minorSplitLine: { show: true }, ...yAxisBase }
        : { type: 'value', ...yAxisBase },
      dataZoom: [
        {
          type: 'inside',
          zoomOnMouseWheel: true,
          startValue: zoomStartValue.value,
          endValue: zoomEndValue.value,
        },
        {
          type: 'slider',
          height: 20,
          bottom: 10,
          startValue: zoomStartValue.value,
          endValue: zoomEndValue.value,
          borderColor: 'transparent',
          backgroundColor: '#1e2028',
          fillerColor: 'rgba(76, 141, 255, 0.15)',
          handleStyle: { color: '#4c8dff', borderColor: '#4c8dff' },
          moveHandleStyle: { color: '#4c8dff' },
          textStyle: { color: '#8b8d98' },
          dataBackground: {
            lineStyle: { color: '#2a2d38' },
            areaStyle: { color: '#1e2028' },
          },
        },
      ],
      series: [
        {
          name: 'Price',
          type: 'line',
          color: CHART_COLORS.accent,
          symbol: 'none',
          smooth: true,
          data: r.prices,
          lineStyle: { width: 2, color: CHART_COLORS.accent },
          areaStyle: { color: CHART_COLORS.area },
        },
        {
          name: 'SMA',
          type: 'line',
          color: CHART_COLORS.sma,
          symbol: 'none',
          smooth: true,
          data: r.sma,
          lineStyle: { width: 1.5, color: CHART_COLORS.sma },
        },
        {
          name: 'Upper Band',
          type: 'line',
          color: CHART_COLORS.upperBand,
          smooth: true,
          symbol: 'none',
          data: r.upper_band,
          lineStyle: { width: 1, color: CHART_COLORS.upperBand, type: 'dashed' },
        },
        {
          name: 'Lower Band',
          type: 'line',
          color: CHART_COLORS.lowerBand,
          symbol: 'none',
          smooth: true,
          data: r.lower_band,
          lineStyle: { width: 1, color: CHART_COLORS.lowerBand, type: 'dashed' },
        },
        {
          name: 'Buy Signal',
          type: 'scatter',
          symbol: 'circle',
          symbolSize: 10,
          itemStyle: { color: CHART_COLORS.buy },
          data: r.prices
            .map((p, i) => (r.signal[i] === 'BUY' ? [r.dates[i], p] : null))
            .filter(Boolean),
        },
        {
          name: 'Sell Signal',
          type: 'scatter',
          symbol: 'circle',
          symbolSize: 10,
          itemStyle: { color: CHART_COLORS.sell },
          data: r.prices
            .map((p, i) => (r.signal[i] === 'SELL' ? [r.dates[i], p] : null))
            .filter(Boolean),
        },
      ],
    },
    { notMerge: true },
  )
}

onMounted(async () => {
  await nextTick()
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)

  chart.on('datazoom', (evt: unknown) => {
    if (!chart) return
    if (!isDataZoomEvent(evt)) return

    const option = chart.getOption()
    const dz = (
      option.dataZoom as Array<{ startValue?: number; endValue?: number }> | undefined
    )?.[0]

    if (!dz) return

    zoomStartValue.value = dz.startValue ?? null
    zoomEndValue.value = dz.endValue ?? null
  })

  renderChart()
  window.addEventListener('resize', onResize)
})

const onResize = () => chart?.resize()

watch([() => props.data, () => props.logScale], renderChart)

watch(
  () => props.symbol,
  () => {
    zoomStartValue.value = null
    zoomEndValue.value = null
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
}
</style>
