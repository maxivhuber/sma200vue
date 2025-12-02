import { API_CONFIG } from '@/api/config'
import type { LiveStrategyMessage } from '@/types/LiveStrategyMessage'
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useLiveStrategyData(symbol: Ref<string | null>, strategy: Ref<string | null>) {
  const liveData = ref<LiveStrategyMessage | null>(null)
  let ws: WebSocket | null = null

  const connect = () => {
    if (!symbol.value || !strategy.value) return

    const wsBase = API_CONFIG.baseURL.replace('http://', 'ws://')

    const path = `/analytics/${strategy.value}/ws`
    const url = new URL(path, wsBase)
    url.searchParams.set('symbol', symbol.value)

    ws = new WebSocket(url.toString())

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

  watch([symbol, strategy], () => {
    disconnect()
    connect()
  })

  onBeforeUnmount(disconnect)

  return { liveData }
}
