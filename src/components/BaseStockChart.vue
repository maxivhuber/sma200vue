<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
import type { DataZoomEvent } from '@/types/DataZoomEvent'
import type { StockDataPoint } from '@/types/StockDataPoint'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const CHART_COLORS = {
  accent: '#4c8dff',
  grid: '#2a2d38',
  text: '#8b8d98',
  axis: '#3a3d48',
  tooltip: 'rgba(24, 26, 32, 0.95)',
  area: 'rgba(76, 141, 255, 0.08)',
}

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

function isDataZoomEvent(raw: unknown): raw is DataZoomEvent {
  return typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'datazoom'
}

const renderBaseChart = () => {
  if (!chart || !props.data) return

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

  const yAxisBase = {
    scale: true,
    min: 'dataMin' as const,
    max: 'dataMax' as const,
    axisLabel: {
      formatter: (v: number) => Number(v).toFixed(2),
      color: CHART_COLORS.text,
    },
    axisLine: { lineStyle: { color: CHART_COLORS.axis } },
    splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' as const } },
  }

  chart.setOption(
    {
      title: {
        text: props.symbol,
        left: 'center',
        top: 10,
        textStyle: { fontSize: 16, fontWeight: '600' as const, color: CHART_COLORS.text },
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
      legend: {
        left: 'center',
        top: 40,
        itemGap: 30,
        icon: 'rect',
        itemWidth: 16,
        itemHeight: 1.8,
        textStyle: { color: CHART_COLORS.text },
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
          name: 'Close',
          type: 'line',
          symbol: 'none',
          smooth: true,
          data: closes,
          lineStyle: { width: 2, color: CHART_COLORS.accent },
          areaStyle: { color: CHART_COLORS.area },
          color: CHART_COLORS.accent,
        },
      ],
    },
    { notMerge: true },
  )

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
  window.addEventListener('resize', onResize)
})

const onResize = () => chart?.resize()

watch([() => props.data, () => props.logScale], renderBaseChart)

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
