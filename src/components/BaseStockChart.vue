<script setup lang="ts">
import { baseChartOption, CHART_COLORS, legendOption } from '@/charts/baseChartOption'
import { useEChart } from '@/composables/useEChart'
import type { StockDataPoint } from '@/types/StockDataPoint'
import type { EChartsOption } from 'echarts'
import { computed, useTemplateRef } from 'vue'

const { symbol, data, logScale, compact } = defineProps<{
  symbol: string
  data: StockDataPoint[] | null
  logScale: boolean
  compact: boolean
}>()

const option = computed<EChartsOption | null>(() => {
  if (!data) return null
  return {
    ...baseChartOption({ title: symbol, dates: data.map((p) => p.Date), logScale, compact }),
    legend: legendOption(compact),
    series: [
      {
        name: 'Close',
        type: 'line',
        symbol: 'none',
        smooth: true,
        data: data.map((p) => p.Close),
        lineStyle: { width: compact ? 1.5 : 2, color: CHART_COLORS.accent },
        areaStyle: { color: CHART_COLORS.area },
        color: CHART_COLORS.accent,
      },
    ],
  }
})

useEChart(useTemplateRef('chart'), option)
</script>

<template>
  <div ref="chart" class="chart-container"></div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
