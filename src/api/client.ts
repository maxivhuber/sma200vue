import { API_CONFIG } from './config'

export async function apiFetch<T>(path: string): Promise<T> {
  const url = new URL(path, API_CONFIG.baseURL).toString()

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}
