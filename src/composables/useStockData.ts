import { apiFetch } from '@/api/client'
import { db } from '@/db'
import { ref, watch, type Ref } from 'vue'

export interface StockDataPoint {
  Date: string
  Open: number
  High: number
  Low: number
  Close: number
  'Adj Close': number
  Volume: number
}

function nextMidnight() {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.getTime()
}

export function useStockData(selectedSymbol: Ref<string | null>) {
  const data = ref<StockDataPoint[] | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function load(symbol: string) {
    const cached = await db.stockdata.get(symbol)
    if (cached && Date.now() < cached.expireAt) return cached.data
    return null
  }

  async function save(symbol: string, newData: StockDataPoint[]) {
    await db.stockdata.put({ id: symbol, data: newData, expireAt: nextMidnight() })
  }

  async function fetchData(symbol: string) {
    const cached = await load(symbol)
    if (cached) {
      data.value = cached
      return
    }
    loading.value = true
    error.value = null
    try {
      const result = await apiFetch<StockDataPoint[]>(
        `/history?symbol=${encodeURIComponent(symbol)}`,
      )
      data.value = result
      await save(symbol, result)
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  watch(
    selectedSymbol,
    (s) => {
      if (s) fetchData(s)
      else data.value = null
    },
    { immediate: true },
  )

  return { data, loading, error }
}
