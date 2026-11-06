import { WS_CONFIG } from '@/api/config'
import type { LiveStrategyMessage } from '@/types/LiveStrategyMessage'
import { onWatcherCleanup, shallowRef, watch, type Ref } from 'vue'

/**
 * Streams live strategy ticks for the selected symbol/strategy.
 *
 * Each watcher run owns exactly one socket and closes it in `onWatcherCleanup`,
 * which runs before the next run and when the owning component unmounts.
 */
export function useLiveStrategyData(symbol: Ref<string | null>, strategy: Ref<string | null>) {
  const liveData = shallowRef<LiveStrategyMessage | null>(null)

  watch(
    [symbol, strategy],
    ([s, st]) => {
      liveData.value = null
      if (!s || !st) return

      const params = new URLSearchParams({ symbol: s })
      const ws = new WebSocket(`${WS_CONFIG.baseURL}analytics/${encodeURIComponent(st)}?${params}`)

      ws.onmessage = (e: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(e.data) as LiveStrategyMessage
          if (msg.symbol === s && msg.strategy === st) liveData.value = msg
        } catch {
          // Ignore malformed frames; the next tick replaces them anyway.
        }
      }

      onWatcherCleanup(() => ws.close())
    },
    { immediate: true },
  )

  return { liveData }
}
