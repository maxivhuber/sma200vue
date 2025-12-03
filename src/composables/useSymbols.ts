import { getSymbols } from '@/api/requests'
import type { LabeledItem } from '@/types/LabeledItem'
import { onMounted, ref } from 'vue'

export function useSymbols() {
  const symbols = ref<LabeledItem[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function fetchSymbols() {
    loading.value = true
    error.value = null
    try {
      symbols.value = await getSymbols()
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchSymbols)

  return { symbols, loading, error, fetchSymbols }
}
