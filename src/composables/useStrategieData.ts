import { apiFetch } from '@/api/client'
import { db } from '@/db'
import { DateTime } from 'luxon'
import type { Ref } from 'vue'
import { ref, watch } from 'vue'

export interface SMAResult {
  dates: string[]
  prices: number[]
  sma: number[]
  upper_band: number[]
  lower_band: number[]
  signal: string[]
}

export interface SMAResponse {
  symbol: string
  strategy: 'sma'
  timestamp: string
  result: SMAResult
}

function nextMidnightNewYork(): number {
  return DateTime.now().setZone('America/New_York').plus({ days: 1 }).startOf('day').toMillis()
}

export function useStrategieData(symbol: Ref<string | null>, strategy: Ref<string | null>) {
  const data = ref<SMAResponse | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function load(key: string): Promise<SMAResponse | null> {
    const cached = await db.stockdata.get(key)

    if (cached && Date.now() < cached.expireAt) {
      if (cached.data && typeof cached.data === 'object' && 'strategy' in cached.data) {
        return cached.data as SMAResponse
      }
    }
    return null
  }

  async function save(key: string, newData: SMAResponse) {
    await db.stockdata.put({
      id: key,
      data: newData,
      expireAt: nextMidnightNewYork(),
    })
  }

  async function fetchData(s: string, st: string) {
    const key = `${s}:${st}`

    const cached = await load(key)
    if (cached) {
      data.value = cached
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await apiFetch<SMAResponse>(
        `/analytics/${encodeURIComponent(st)}?symbol=${encodeURIComponent(s)}`,
      )
      data.value = response
      await save(key, response)
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  watch(
    [symbol, strategy],
    async ([s, st]) => {
      if (!s || !st) {
        data.value = null
        return
      }

      if (st !== 'sma') {
        data.value = null
        return
      }

      fetchData(s, st)
    },
    { immediate: true },
  )

  return { data, loading, error }
}
