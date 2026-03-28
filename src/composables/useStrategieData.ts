import { apiFetch } from '@/api/client'
import { db } from '@/db'
import type { SMAResponse } from '@/types/SMA'
import { nextMidnightNewYork } from '@/utils/nextMidnightNewYork'
import type { Ref } from 'vue'
import { ref, watch } from 'vue'

export function useStrategieData(symbol: Ref<string | null>, strategy: Ref<string | null>) {
  const data = ref<SMAResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let fetchId = 0

  async function load(key: string): Promise<SMAResponse | null> {
    const cached = await db.stockdata.get(key)

    if (cached && Date.now() < cached.expireAt && cached.type === 'strategy') {
      return cached.data as SMAResponse
    }
    return null
  }

  async function save(key: string, newData: SMAResponse) {
    await db.stockdata.put({
      id: key,
      type: 'strategy',
      data: newData,
      expireAt: nextMidnightNewYork(),
    })
  }

  async function fetchData(s: string, st: string) {
    const id = ++fetchId
    const key = `${s}:${st}`

    const cached = await load(key)
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
      const response = await apiFetch<SMAResponse>(
        `/analytics/${encodeURIComponent(st)}?symbol=${encodeURIComponent(s)}`,
      )
      if (id !== fetchId) return
      data.value = response
      await save(key, response)
    } catch (err) {
      if (id !== fetchId) return
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (id === fetchId) loading.value = false
    }
  }

  watch(
    [symbol, strategy],
    ([s, st]) => {
      data.value = null
      loading.value = false
      error.value = null
      if (!s || !st) return
      if (st !== 'sma') return
      fetchData(s, st)
    },
    { immediate: true },
  )

  return { data, loading, error }
}
