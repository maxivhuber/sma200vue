import { apiFetch } from '@/api/client'
import { db } from '@/db'
import type { StockDataPoint } from '@/types/StockDataPoint'
import { nextMidnightNewYork } from '@/utils/nextMidnightNewYork'
import { ref, watch, type Ref } from 'vue'

export function useStockData(selectedSymbol: Ref<string | null>) {
  const data = ref<StockDataPoint[] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let fetchId = 0

  async function load(symbol: string) {
    const cached = await db.stockdata.get(symbol)
    if (cached && Date.now() < cached.expireAt && cached.type === 'stock') {
      return cached.data as StockDataPoint[]
    }
    return null
  }

  async function save(symbol: string, newData: StockDataPoint[]) {
    await db.stockdata.put({
      id: symbol,
      type: 'stock',
      data: newData,
      expireAt: nextMidnightNewYork(),
    })
  }

  async function fetchData(symbol: string) {
    const id = ++fetchId

    const cached = await load(symbol)
    if (id !== fetchId) return
    if (cached) {
      data.value = cached
      loading.value = false
      error.value = null
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await apiFetch<StockDataPoint[]>(
        `/history?symbol=${encodeURIComponent(symbol)}`,
      )
      if (id !== fetchId) return
      data.value = result
      await save(symbol, result)
    } catch (err) {
      if (id !== fetchId) return
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (id === fetchId) loading.value = false
    }
  }

  watch(
    selectedSymbol,
    (s) => {
      data.value = null
      loading.value = false
      error.value = null
      if (s) fetchData(s)
    },
    { immediate: true },
  )

  return { data, loading, error }
}
