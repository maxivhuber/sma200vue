<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
import type { DataZoomEvent } from '@/types/DataZoomEvent'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

const getPrimaryColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim()

function isDataZoomEvent(raw: unknown): raw is DataZoomEvent {
  return typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'datazoom'
}

const renderChart = () => {
  if (!chart || !props.data) return

  const r = props.data.result
  const primary = getPrimaryColor()

  if (zoomStartValue.value === null || zoomEndValue.value === null) {
    const ytdYear = new Date().getFullYear()
    const ytdStartDate = `${ytdYear}-01-01`
    const startIndex = r.dates.findIndex((d) => d >= ytdStartDate)
    const endIndex = r.dates.length - 1

    zoomStartValue.value = startIndex
    zoomEndValue.value = endIndex
  }

  chart.setOption({
    title: {
      text: props.symbol,
      left: 'center',
      top: 6,
      textStyle: { fontSize: 18, fontWeight: 'bold' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(40,40,40,0.85)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
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
        textStyle: { fontSize: 12, color: '#555' },
      },
    ],
    grid: { left: 50, right: 30, top: 80, bottom: 50 },
    xAxis: {
      type: 'category',
      data: r.dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: {
        color: '#777',
      },
    },
    yAxis: props.logScale
      ? {
          type: 'log',
          logBase: 10,
          minorSplitLine: { show: true },
          scale: true,
          min: 'dataMin',
          max: 'dataMax',
          axisLabel: { color: '#777', formatter: (v: number) => Number(v).toFixed(2) },
          axisLine: { lineStyle: { color: '#666' } },
        }
      : {
          type: 'value',
          scale: true,
          min: 'dataMin',
          max: 'dataMax',
          axisLabel: { color: '#777', formatter: (v: number) => Number(v).toFixed(2) },
          axisLine: { lineStyle: { color: '#666' } },
        },
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
      },
    ],
    series: [
      {
        name: 'Price',
        type: 'line',
        color: primary,
        symbol: 'none',
        smooth: true,
        data: r.prices,
        lineStyle: { width: 2.2, color: primary },
        areaStyle: { color: 'rgba(150,150,200,0.25)' },
      },
      {
        name: 'SMA',
        type: 'line',
        color: '#888',
        symbol: 'none',
        smooth: true,
        data: r.sma,
        lineStyle: { width: 1.5, color: '#888' },
      },
      {
        name: 'Upper Band',
        type: 'line',
        color: 'green',
        smooth: true,
        symbol: 'none',
        data: r.upper_band,
        lineStyle: { width: 1, color: 'green', type: 'dashed' },
      },
      {
        name: 'Lower Band',
        type: 'line',
        color: 'red',
        symbol: 'none',
        smooth: true,
        data: r.lower_band,
        lineStyle: { width: 1, color: 'red', type: 'dashed' },
      },
      {
        name: 'Buy Signal',
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: { color: '#00c853' },
        data: r.prices
          .map((p, i) => (r.signal[i] === 'BUY' ? [r.dates[i], p] : null))
          .filter(Boolean),
      },
      {
        name: 'Sell Signal',
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: { color: '#d50000' },
        data: r.prices
          .map((p, i) => (r.signal[i] === 'SELL' ? [r.dates[i], p] : null))
          .filter(Boolean),
      },
    ],
  })
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
  window.addEventListener('resize', () => chart?.resize())
})

// Re-render chart when data or logScale changes — but keep zoom
watch([() => props.data, () => props.logScale], renderChart)

// Reset zoom when symbol changes → next renderChart() uses YTD
watch(
  () => props.symbol,
  () => {
    zoomStartValue.value = null
    zoomEndValue.value = null
  },
)

onBeforeUnmount(() => chart?.dispose())
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
}
</style>
