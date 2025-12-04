<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
import type { DataZoomEvent } from '@/types/DataZoomEvent'
import type { StockDataPoint } from '@/types/StockDataPoint'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  symbol: string
  strategie: string | null
  data: StockDataPoint[] | null
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

const renderBaseChart = () => {
  if (!chart || !props.data) return

  const primary = getPrimaryColor()
  const dates = props.data.map((p) => p.Date)
  const closes = props.data.map((p) => p.Close)

  if (zoomStartValue.value === null || zoomEndValue.value === null) {
    const ytdYear = new Date().getFullYear()
    const ytdStartDate = `${ytdYear}-01-01`

    const startIndex = dates.findIndex((d) => d >= ytdStartDate)
    const endIndex = dates.length - 1

    zoomStartValue.value = startIndex
    zoomEndValue.value = endIndex
  }

  chart.setOption({
    color: [primary],
    title: {
      text: props.symbol,
      left: 'center',
      top: 10,
      textStyle: { fontSize: 16, fontWeight: 'bold' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(40,40,40,0.85)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
      valueFormatter: (v: number) => Number(v).toFixed(2),
    },
    legend: {
      left: 'center',
      top: 40,
      itemGap: 30,
      icon: 'rect',
      itemWidth: 16,
      itemHeight: 1.8,
    },
    grid: {
      left: 50,
      right: 30,
      top: 80,
      bottom: 50,
    },
    xAxis: {
      type: 'category',
      data: dates,
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
          axisLabel: {
            formatter: (v: number) => Number(v).toFixed(2),
            color: '#777',
          },
          axisLine: { lineStyle: { color: '#666' } },
        }
      : {
          type: 'value',
          scale: true,
          min: 'dataMin',
          max: 'dataMax',
          axisLabel: {
            formatter: (v: number) => Number(v).toFixed(2),
            color: '#777',
          },
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
        name: 'Close',
        type: 'line',
        symbol: 'none',
        smooth: true,
        data: closes,
        lineStyle: { width: 2.2, color: primary },
        areaStyle: { color: 'rgba(150,150,200,0.25)' },
      },
    ],
  })

  chart.resize()
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

  renderBaseChart()
  window.addEventListener('resize', () => chart?.resize())
})

// Re-render chart when data or logScale changes — but keep zoom
watch([() => props.data, () => props.logScale], renderBaseChart)

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
