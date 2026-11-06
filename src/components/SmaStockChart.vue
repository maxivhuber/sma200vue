<script setup lang="ts">
import { baseChartOption, CHART_COLORS, legendOption } from '@/charts/baseChartOption'
import { useEChart } from '@/composables/useEChart'
import type { SMAResponse } from '@/types/SMA'
import type { EChartsOption } from 'echarts'
import { computed, useTemplateRef } from 'vue'

const { symbol, data, logScale, compact } = defineProps<{
  symbol: string
  data: SMAResponse | null
  logScale: boolean
  compact: boolean
}>()

const LINE_ITEMS = ['Price', 'SMA', 'Upper Band', 'Lower Band'].map((name) => ({
  name,
  icon: 'rect',
}))
const SIGNAL_ITEMS = ['Buy Signal', 'Sell Signal'].map((name) => ({ name, icon: 'circle' }))

const option = computed<EChartsOption | null>(() => {
  if (!data) return null
  const r = data.result

  const signalPoints = (kind: 'BUY' | 'SELL') =>
    r.prices.flatMap((p, i) => (r.signal[i] === kind ? [[r.dates[i], p]] : []))

  const band = (name: string, values: number[], color: string) => ({
    name,
    type: 'line' as const,
    color,
    symbol: 'none',
    smooth: true,
    data: values,
    lineStyle: { width: 1, color, type: 'dashed' as const },
  })

  const signal = (name: string, kind: 'BUY' | 'SELL', color: string) => ({
    name,
    type: 'scatter' as const,
    symbol: 'circle',
    symbolSize: compact ? 6 : 10,
    itemStyle: { color },
    data: signalPoints(kind),
  })

  return {
    ...baseChartOption({ title: symbol, dates: r.dates, logScale, compact }),
    legend: compact
      ? legendOption(true, { data: [...LINE_ITEMS, ...SIGNAL_ITEMS] })
      : [
          legendOption(false, { top: 32, data: LINE_ITEMS }),
          legendOption(false, {
            top: 52,
            itemGap: 15,
            itemWidth: 12,
            itemHeight: 12,
            data: SIGNAL_ITEMS,
          }),
        ],
    series: [
      {
        name: 'Price',
        type: 'line',
        color: CHART_COLORS.accent,
        symbol: 'none',
        smooth: true,
        data: r.prices,
        lineStyle: { width: compact ? 1.5 : 2, color: CHART_COLORS.accent },
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
      band('Upper Band', r.upper_band, CHART_COLORS.upperBand),
      band('Lower Band', r.lower_band, CHART_COLORS.lowerBand),
      signal('Buy Signal', 'BUY', CHART_COLORS.buy),
      signal('Sell Signal', 'SELL', CHART_COLORS.sell),
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
