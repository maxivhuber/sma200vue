import { LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { init, use, type ECharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { DataZoomComponentOption, EChartsOption } from 'echarts'
import { onBeforeUnmount, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue'

use([
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
])

type ZoomWindow = Pick<DataZoomComponentOption, 'startValue' | 'endValue'>

/**
 * Owns an ECharts instance bound to `el`: init, re-render on option change,
 * resize on container size change, user zoom persistence, dispose.
 */
export function useEChart(
  el: Readonly<ShallowRef<HTMLElement | null>>,
  option: MaybeRefOrGetter<EChartsOption | null>,
) {
  let chart: ECharts | null = null
  let zoom: ZoomWindow | null = null
  const observer = new ResizeObserver(() => chart?.resize())

  function withZoom(opt: EChartsOption): EChartsOption {
    if (!zoom || !Array.isArray(opt.dataZoom)) return opt
    return { ...opt, dataZoom: opt.dataZoom.map((dz) => ({ ...dz, ...zoom })) }
  }

  watch(
    [el, () => toValue(option)],
    ([node, opt]) => {
      if (!node || !opt) return
      if (!chart) {
        chart = init(node)
        chart.on('datazoom', () => {
          const [dz] = (chart?.getOption().dataZoom ?? []) as DataZoomComponentOption[]
          if (dz) zoom = { startValue: dz.startValue, endValue: dz.endValue }
        })
        observer.observe(node)
      }
      chart.setOption(withZoom(opt), { notMerge: true })
    },
    { flush: 'post', immediate: true },
  )

  onBeforeUnmount(() => {
    observer.disconnect()
    chart?.dispose()
    chart = null
  })
}
