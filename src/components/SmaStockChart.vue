<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
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

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const getPrimaryColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim()

const renderChart = () => {
  if (!chart || !props.data) return
  const r = props.data.result
  const primary = getPrimaryColor()

  chart.setOption({
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
      valueFormatter: (v: number) => Number(v).toFixed(3),
    },
    legend: {
      data: ['Price', 'SMA', 'Upper Band', 'Lower Band', 'Signals'],
      left: 'center',
      top: 40,
      itemGap: 20,
    },
    grid: {
      left: 50,
      right: 30,
      top: 80,
      bottom: 50,
    },
    xAxis: {
      type: 'category',
      data: r.dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#666' } },
      axisLabel: {
        color: '#777',
        formatter: (v: string) => v.split('T')[0],
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
            formatter: (v: number) => Number(v).toFixed(3),
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
            formatter: (v: number) => Number(v).toFixed(3),
            color: '#777',
          },
          axisLine: { lineStyle: { color: '#666' } },
        },
    dataZoom: [
      { type: 'inside', zoomOnMouseWheel: true },
      { type: 'slider', height: 20, bottom: 10 },
    ],
    series: [
      {
        name: 'Price',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: r.prices,
        lineStyle: { width: 2.2, color: primary },
      },
      {
        name: 'SMA',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: r.sma,
        lineStyle: { width: 1.5, color: '#888' },
      },
      {
        name: 'Upper Band',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: r.upper_band,
        lineStyle: { width: 1, color: '#c77d7d', type: 'dashed' },
      },
      {
        name: 'Lower Band',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: r.lower_band,
        lineStyle: { width: 1, color: '#7db3c7', type: 'dashed' },
      },
      {
        name: 'Signals',
        type: 'scatter',
        symbolSize: 9,
        data: r.prices
          .map((p, i) => {
            const s = r.signal[i]
            if (s === 'BUY') return { value: [r.dates[i], p], itemStyle: { color: '#00c853' } }
            if (s === 'SELL') return { value: [r.dates[i], p], itemStyle: { color: '#d50000' } }
            return null
          })
          .filter(Boolean),
      },
    ],
  })
}

onMounted(async () => {
  await nextTick()
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  renderChart()
  window.addEventListener('resize', () => chart?.resize())
})

watch([() => props.data, () => props.logScale], renderChart)

onBeforeUnmount(() => chart?.dispose())
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
}
</style>
