import { apiFetch } from '@/api/client'
import { db } from '@/db'
import type { SMAResponse } from '@/types/SMA'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { Ref } from 'vue'
import { ref, watch } from 'vue'

dayjs.extend(utc)
dayjs.extend(timezone)

function nextMidnightNewYork(): number {
  const nowNY = dayjs().tz('America/New_York')
  const nextMidnight = nowNY.add(1, 'day').startOf('day')
  return nextMidnight.valueOf()
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
