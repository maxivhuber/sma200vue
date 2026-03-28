import { WS_CONFIG } from '@/api/config'
import type { LiveStrategyMessage } from '@/types/LiveStrategyMessage'
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useLiveStrategyData(symbol: Ref<string | null>, strategy: Ref<string | null>) {
  const liveData = ref<LiveStrategyMessage | null>(null)
  let ws: WebSocket | null = null

  const disconnect = () => {
    if (ws) {
      ws.onmessage = null
      ws.close()
      ws = null
    }
  }

  const connect = () => {
    if (!symbol.value || !strategy.value) return
    disconnect()

    const url = `${WS_CONFIG.baseURL}analytics/${strategy.value}?symbol=${symbol.value}`
    ws = new WebSocket(url)

    ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data as string) as LiveStrategyMessage
        if (parsed.symbol !== symbol.value) return
        liveData.value = parsed
      } catch {}
    }

    ws.onclose = () => {
      ws = null
    }
  }

  watch(
    [symbol, strategy],
    () => {
      liveData.value = null
      disconnect()

      if (symbol.value && strategy.value) {
        connect()
      }
    },
    { flush: 'post' },
  )

  onBeforeUnmount(disconnect)

  return { liveData }
}
