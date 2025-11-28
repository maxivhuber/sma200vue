<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
import type { StockDataPoint } from '@/composables/useStockData'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  symbol: string
  strategie: string | null
  data: StockDataPoint[] | null
  logScale: boolean
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const getPrimaryColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim()

const renderChart = () => {
  if (!chart || !props.data) return

  const color = getPrimaryColor()

  chart.setOption({
    color: [color],
    title: { text: props.symbol },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: props.data.map((p) => p.Date) },
    yAxis: props.logScale
      ? { type: 'log', logBase: 10, minorSplitLine: { show: true } }
      : { type: 'value' },
    dataZoom: [{ type: 'inside' }, { type: 'slider' }],
    series: [
      {
        name: 'Close',
        data: props.data.map((p) => p.Close),
        type: 'line',
        smooth: true,
      },
    ],
  })

  chart.resize()
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
