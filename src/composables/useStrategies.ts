import { getStrategies } from '@/api/requests'
import { onMounted, ref } from 'vue'

export function useStrategies() {
  const strategies = ref<string[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function fetchStrategies() {
    loading.value = true
    error.value = null
    try {
      strategies.value = await getStrategies()
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchStrategies)

  return { strategies, loading, error, fetchStrategies }
}
