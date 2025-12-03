import { WS_CONFIG } from '@/api/config'
import type { LiveStrategyMessage } from '@/types/LiveStrategyMessage'
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useLiveStrategyData(symbol: Ref<string | null>, strategy: Ref<string | null>) {
  const liveData = ref<LiveStrategyMessage | null>(null)
  let ws: WebSocket | null = null

  const connect = () => {
    if (!symbol.value || !strategy.value) return

    const url = `${WS_CONFIG.baseURL}analytics/${strategy.value}?symbol=${symbol.value}`
    ws = new WebSocket(url)

    ws.onmessage = (e) => {
      try {
        liveData.value = JSON.parse(e.data) as LiveStrategyMessage
      } catch {}
    }

    ws.onclose = () => {
      ws = null
    }
  }

  const disconnect = () => {
    if (ws) {
      ws.close()
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
